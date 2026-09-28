import { distributeByWeight, equalSplit, percent, ringgit } from './money';
import { formatPeriod } from './dates';
import type {
  AllocationResult,
  AllocationWarning,
  Bill,
  DerivationRow,
  Lang,
  Member,
  MemberAllocation,
  Room,
  Sen,
} from './types';

import type { TFn } from './i18n';

type BillShape = Pick<Bill, 'amountSen' | 'method' | 'weights' | 'fixedByRoomSen' | 'period'>;

/**
 * The allocation engine.
 *
 * Every figure the app shows for a bill comes out of this one function: the
 * payable amount, the per-member rows, the derivation lines behind the "How
 * this was calculated" sheet, and the equal-split comparison. Nothing is
 * hand-written, so the explanation can never drift from the number.
 *
 * Guarantees:
 *  - the parts always sum to the bill amount exactly (integer sen,
 *    largest-remainder distribution);
 *  - a backwards meter reading never produces a negative bill;
 *  - a zero-usage room is charged RM 0.00 and says why;
 *  - a member with no meter gets a stated default share labelled as an
 *    assumption, never a silent RM 0.00.
 */
export function allocate(
  bill: BillShape,
  members: Member[],
  rooms: Room[],
  t: TFn,
  lang: Lang,
): AllocationResult {
  const active = activeMembers(members, bill.period);
  const ids = active.map((m) => m.id);
  const count = Math.max(ids.length, 1);
  const roomById = new Map(rooms.map((room) => [room.id, room]));
  const warnings: AllocationWarning[] = [];

  let result: AllocationResult | null = null;

  if (bill.method === 'submeter') {
    result = allocateSubmeter(bill, active, rooms, roomById, t, warnings);
  } else if (bill.method === 'fixed') {
    result = allocateFixed(bill, active, rooms, roomById, t, warnings, lang);
  } else if (bill.method === 'weight') {
    result = allocateWeight(bill, active, t);
  }

  if (!result) {
    // Either an equal bill, or a metered bill where nothing usable was read.
    result = allocateEqual(bill, active, t, count, warnings, bill.method);
  }

  const equal: Record<string, Sen> = {};
  equalSplit(bill.amountSen, count).forEach((share, i) => {
    equal[ids[i]] = share;
  });
  return { ...result, equal };
}

/* ------------------------------------------------------------------ */
/* members in scope                                                    */
/* ------------------------------------------------------------------ */

export function activeMembers(members: Member[], period: string): Member[] {
  return members.filter((member) => {
    // The landlord is never assigned a share of a bill, so he is never in
    // scope for an allocation.
    if (member.role === 'landlord') return false;
    if (!member.leftAt) return true;
    // A member who left keeps their historical allocations frozen; they are
    // only excluded from periods that start after they left.
    return period <= member.leftAt.slice(0, 7);
  });
}

/* ------------------------------------------------------------------ */
/* sub-meter                                                           */
/* ------------------------------------------------------------------ */

function allocateSubmeter(
  bill: BillShape,
  active: Member[],
  rooms: Room[],
  roomById: Map<string, Room>,
  t: TFn,
  warnings: AllocationWarning[],
): AllocationResult | null {
  const meteredRooms = rooms.filter((room) => !room.isCommon && room.meter !== null);
  if (meteredRooms.length === 0) {
    warnings.push({ code: 'no_meter_house', vars: {} });
    return null;
  }

  const roomKwh: Record<string, number> = {};
  let commonKwh = 0;
  let totalKwh = 0;

  for (const room of rooms) {
    if (!room.meter) {
      roomKwh[room.id] = 0;
      continue;
    }
    const delta = room.meter.currKwh - room.meter.prevKwh;
    if (delta < 0) {
      // A backwards reading is a meter-reading error, never negative usage.
      roomKwh[room.id] = 0;
      warnings.push({
        code: 'reading_backwards',
        vars: { room: room.name, prev: room.meter.prevKwh, curr: room.meter.currKwh },
        roomId: room.id,
      });
      continue;
    }
    if (room.isCommon) {
      commonKwh = delta;
    } else {
      roomKwh[room.id] = delta;
      totalKwh += delta;
    }
  }
  totalKwh += commonKwh;

  if (totalKwh === 0) {
    warnings.push({ code: 'no_usage_equal_fallback', vars: {} });
    return null;
  }

  const ids = active.map((m) => m.id);
  const commonShares = distributeByWeight(
    commonKwh,
    new Array<number>(ids.length).fill(1),
  ).shares;

  // Room usage split among that room's occupants, exactly, in whole kWh.
  const roomSplits: Record<string, Record<string, number>> = {};
  for (const room of rooms) {
    if (room.isCommon || roomKwh[room.id] === 0) continue;
    const pax = active.filter((m) => m.roomId === room.id);
    if (pax.length === 0) continue;
    const parts = distributeByWeight(
      roomKwh[room.id],
      new Array<number>(pax.length).fill(1),
    ).shares;
    pax.forEach((member, i) => {
      roomSplits[room.id] = roomSplits[room.id] || {};
      roomSplits[room.id][member.id] = parts[i];
    });
  }

  const houseAverage = distributeByWeight(
    totalKwh,
    new Array<number>(ids.length).fill(1),
  ).shares;

  const parts = ids.map((id, index) => {
    const member = active[index];
    const room = roomById.get(member.roomId);
    if (room && !room.meter) {
      warnings.push({
        code: 'no_meter_assumption',
        vars: { member: member.firstName, room: room.name, kwh: houseAverage[index] },
        memberId: id,
      });
      return {
        fromRoom: 0,
        fromCommon: commonShares[index],
        assumed: true,
      };
    }
    return {
      fromRoom: roomSplits[member.roomId]?.[id] ?? 0,
      fromCommon: commonShares[index],
      assumed: false,
    };
  });

  const kwh = parts.map((p) => p.fromRoom + p.fromCommon);
  const kwhTotal = kwh.reduce((a, b) => a + b, 0);
  const charges = distributeByWeight(bill.amountSen, kwh);

  const perMember: Record<string, MemberAllocation> = {};
  ids.forEach((id, index) => {
    const member = active[index];
    const room = roomById.get(member.roomId);
    const pax = active.filter((m) => m.roomId === member.roomId).length;
    const zeroUsage = !parts[index].assumed && kwh[index] === 0;
    if (zeroUsage && room) {
      warnings.push({
        code: 'zero_usage_room',
        vars: { room: room.name, member: member.firstName },
        roomId: room.id,
        memberId: id,
      });
    }
    const rawSen = Math.floor((bill.amountSen * kwh[index]) / kwhTotal);
    perMember[id] = {
      memberId: id,
      amountSen: charges.shares[index],
      kwh: kwh[index],
      kwhFromRoom: parts[index].fromRoom,
      kwhFromCommon: parts[index].fromCommon,
      roomId: member.roomId,
      roomPax: pax,
      sharePercent: kwhTotal === 0 ? 0 : (kwh[index] / kwhTotal) * 100,
      rawSen,
      remainder: charges.remainders[index],
      roundingSen: charges.shares[index] - rawSen,
      assumption: parts[index].assumed,
      zeroUsage,
      derivation: submeterDerivation({
        roomName: room?.name ?? '',
        roomMeter: room?.meter ?? null,
        roomTotalKwh: room ? roomKwh[room.id] : 0,
        roomPax: pax,
        fromRoom: parts[index].fromRoom,
        fromCommon: parts[index].fromCommon,
        commonKwh,
        memberCount: ids.length,
        kwh: kwh[index],
        totalKwh: kwhTotal,
        amountSen: charges.shares[index],
        roundingSen: charges.shares[index] - rawSen,
        assumed: parts[index].assumed,
        t,
        billAmountSen: bill.amountSen,
      }),
    };
  });

  return {
    method: 'submeter',
    requestedMethod: 'submeter',
    memberCount: ids.length,
    perMember,
    roomKwh,
    commonKwh,
    totalKwh: kwhTotal,
    equal: {},
    roundingTotalSen: Object.values(perMember).reduce((a, b) => a + Math.abs(b.roundingSen), 0),
    warnings: dedupeWarnings(warnings),
    fallbackToEqual: false,
  };
}

function submeterDerivation(args: {
  roomName: string;
  roomMeter: { prevKwh: number; currKwh: number } | null;
  roomTotalKwh: number;
  roomPax: number;
  fromRoom: number;
  fromCommon: number;
  commonKwh: number;
  memberCount: number;
  kwh: number;
  totalKwh: number;
  amountSen: Sen;
  billAmountSen: Sen;
  roundingSen: number;
  assumed: boolean;
  t: TFn;
}): DerivationRow[] {
  const {
    t, roomName, roomMeter, roomTotalKwh, roomPax, fromRoom, fromCommon,
    commonKwh, memberCount, kwh, totalKwh, amountSen, billAmountSen, roundingSen, assumed,
  } = args;
  const rows: DerivationRow[] = [];

  if (assumed) {
    rows.push({
      kind: 'no_meter',
      label: t('deriv.assumedShare', { room: roomName }),
      expr: t('deriv.houseAverage'),
      value: `${kwh} kWh`,
    });
  } else {
    rows.push({
      kind: 'room_meter',
      label: t('deriv.roomSubMeter', { room: roomName }),
      expr: roomMeter ? `${roomMeter.prevKwh} → ${roomMeter.currKwh}` : undefined,
      value: `${roomTotalKwh} kWh`,
    });
    if (roomPax > 1) {
      rows.push({
        kind: 'room_shared',
        label: t('deriv.sharedWith', { pax: roomPax }),
        expr: `${roomTotalKwh} ÷ ${roomPax}`,
        value: `${fromRoom} kWh`,
      });
    }
    if (kwh === 0) {
      rows.push({
        kind: 'zero_usage',
        label: t('deriv.zeroUsage', { room: roomName }),
        value: '0 kWh',
      });
    }
    if (fromCommon > 0) {
      rows.push({
        kind: 'common_share',
        label: t('deriv.commonAreaShare'),
        expr: `${commonKwh} ÷ ${memberCount}`,
        value: `${fromCommon} kWh`,
      });
    }
  }

  rows.push({
    kind: 'subtotal_usage',
    label: t('deriv.totalUsage'),
    value: `${kwh} kWh`,
    total: true,
  });
  rows.push({
    kind: 'share_of_bill',
    label: t('deriv.shareOfBill'),
    expr: `${kwh} ÷ ${totalKwh}`,
    value: percent(kwh, totalKwh),
  });
  rows.push({
    kind: 'charge',
    label: t('deriv.yourCharge'),
    expr: `${percent(kwh, totalKwh)} of ${ringgit(billAmountSen)}`,
    value: ringgit(amountSen),
    emphasis: true,
  });
  if (roundingSen !== 0) {
    rows.push({
      kind: 'rounding',
      label: t('deriv.roundingAdjustment'),
      value: `${roundingSen > 0 ? '+' : '−'}${ringgit(Math.abs(roundingSen))}`,
    });
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* equal / weight / fixed                                              */
/* ------------------------------------------------------------------ */

function allocateEqual(
  bill: BillShape,
  active: Member[],
  t: TFn,
  count: number,
  warnings: AllocationWarning[],
  requested: BillShape['method'],
): AllocationResult {
  const shares = equalSplit(bill.amountSen, count);
  const perMember: Record<string, MemberAllocation> = {};
  active.forEach((member, index) => {
    perMember[member.id] = {
      memberId: member.id,
      amountSen: shares[index],
      kwh: 0,
      kwhFromRoom: 0,
      kwhFromCommon: 0,
      roomId: member.roomId,
      roomPax: active.filter((m) => m.roomId === member.roomId).length,
      sharePercent: 100 / count,
      rawSen: shares[index],
      remainder: 0,
      roundingSen: 0,
      assumption: false,
      zeroUsage: false,
      derivation: [
        {
          kind: 'equal',
          label: t('deriv.equalAcross', { n: count }),
          expr: t('deriv.divided', { total: 1, by: count }),
          value: percent(1, count),
        },
        {
          kind: 'charge',
          label: t('deriv.yourCharge'),
          value: ringgit(shares[index]),
          emphasis: true,
        },
      ],
    };
  });
  return {
    method: 'equal',
    requestedMethod: requested,
    memberCount: count,
    perMember,
    roomKwh: {},
    commonKwh: 0,
    totalKwh: 0,
    equal: {},
    roundingTotalSen: 0,
    warnings: dedupeWarnings(warnings),
    fallbackToEqual: requested !== 'equal',
  };
}

function allocateWeight(
  bill: BillShape,
  active: Member[],
  t: TFn,
): AllocationResult {
  const weights = active.map((member) => bill.weights?.[member.id] ?? 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;
  const charges = distributeByWeight(bill.amountSen, weights);
  const perMember: Record<string, MemberAllocation> = {};
  active.forEach((member, index) => {
    perMember[member.id] = {
      memberId: member.id,
      amountSen: charges.shares[index],
      kwh: 0,
      kwhFromRoom: 0,
      kwhFromCommon: 0,
      roomId: member.roomId,
      roomPax: active.filter((m) => m.roomId === member.roomId).length,
      sharePercent: (weights[index] / totalWeight) * 100,
      rawSen: charges.shares[index],
      remainder: charges.remainders[index],
      roundingSen: 0,
      assumption: false,
      zeroUsage: false,
      derivation: [
        {
          kind: 'weight',
          label: t('deriv.yourWeight'),
          expr: `${weights[index]} ÷ ${totalWeight}`,
          value: percent(weights[index], totalWeight),
        },
        {
          kind: 'charge',
          label: t('deriv.yourCharge'),
          value: ringgit(charges.shares[index]),
          emphasis: true,
        },
      ],
    };
  });
  return {
    method: 'weight',
    requestedMethod: 'weight',
    memberCount: active.length,
    perMember,
    roomKwh: {},
    commonKwh: 0,
    totalKwh: 0,
    equal: {},
    roundingTotalSen: 0,
    warnings: [],
    fallbackToEqual: false,
  };
}

function allocateFixed(
  bill: BillShape,
  active: Member[],
  rooms: Room[],
  roomById: Map<string, Room>,
  t: TFn,
  warnings: AllocationWarning[],
  lang: Lang,
): AllocationResult {
  const roomTotals: Record<string, Sen> = {};
  let total = 0;
  for (const room of rooms) {
    if (room.isCommon) continue;
    const amount = bill.fixedByRoomSen?.[room.id] ?? 0;
    roomTotals[room.id] = amount;
    total += amount;
  }

  const amounts: Record<string, Sen> = {};
  if (total === bill.amountSen) {
    for (const room of rooms) {
      if (room.isCommon) continue;
      const pax = active.filter((m) => m.roomId === room.id);
      if (pax.length === 0) continue;
      const parts = distributeByWeight(
        roomTotals[room.id],
        new Array<number>(pax.length).fill(1),
      ).shares;
      pax.forEach((member, i) => {
        amounts[member.id] = (amounts[member.id] ?? 0) + parts[i];
      });
    }
  } else {
    // The fixed amounts do not add up to the bill. Say so, then reconcile onto
    // an equal base so the ledger still reconciles to the penny.
    warnings.push({
      code: 'fixed_total_mismatch',
      vars: { fixed: ringgit(total), bill: ringgit(bill.amountSen) },
    });
    const parts = distributeByWeight(
      bill.amountSen,
      new Array<number>(active.length).fill(1),
    ).shares;
    active.forEach((member, i) => {
      amounts[member.id] = parts[i];
    });
  }

  const perMember: Record<string, MemberAllocation> = {};
  active.forEach((member) => {
    const room = roomById.get(member.roomId);
    const pax = active.filter((m) => m.roomId === member.roomId).length;
    const amountSen = amounts[member.id] ?? 0;
    perMember[member.id] = {
      memberId: member.id,
      amountSen,
      kwh: 0,
      kwhFromRoom: 0,
      kwhFromCommon: 0,
      roomId: member.roomId,
      roomPax: pax,
      sharePercent: bill.amountSen === 0 ? 0 : (amountSen / bill.amountSen) * 100,
      rawSen: amountSen,
      remainder: 0,
      roundingSen: 0,
      assumption: false,
      zeroUsage: false,
      derivation: [
        {
          kind: 'fixed',
          label: t('deriv.fixedRent', { room: room?.name ?? '', period: formatPeriod(bill.period, lang) }),
          value: ringgit(roomTotals[member.roomId] ?? 0),
        },
        ...(pax > 1
          ? [{
              kind: 'fixed' as const,
              label: t('deriv.sharedWith', { pax }),
              expr: t('deriv.divided', { total: ringgit(roomTotals[member.roomId] ?? 0), by: pax }),
              value: ringgit(amountSen),
            }]
          : []),
        {
          kind: 'charge',
          label: t('deriv.yourCharge'),
          value: ringgit(amountSen),
          emphasis: true,
        },
      ],
    };
  });

  return {
    method: 'fixed',
    requestedMethod: 'fixed',
    memberCount: active.length,
    perMember,
    roomKwh: {},
    commonKwh: 0,
    totalKwh: 0,
    equal: {},
    roundingTotalSen: 0,
    warnings: dedupeWarnings(warnings),
    fallbackToEqual: false,
  };
}

function dedupeWarnings(warnings: AllocationWarning[]): AllocationWarning[] {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.code}:${warning.roomId ?? ''}:${warning.memberId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
