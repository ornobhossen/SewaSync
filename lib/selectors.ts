import { allocate, activeMembers } from './allocate';
import { daysSince, daysUntil } from './dates';
import { ringgit, sumSen } from './money';
import type {
  ActivityEntry,
  AllocationResult,
  AppState,
  Bill,
  BillCategory,
  BillState,
  Member,
  MemberAllocation,
  PayState,
  Reminder,
  Room,
  Sen,
  Ticket,
} from './types';

import type { TFn } from './i18n';

/* ------------------------------------------------------------------ */
/* categories                                                          */
/* ------------------------------------------------------------------ */

/**
 * The one definition of "a utility bill".
 *
 * The bills filter and the landlord's household total both need this, and
 * they used to disagree: the filter listed the utility categories while the
 * landlord counted everything that was not rent, so groceries were reported
 * to the landlord as a utility. Screens that classify bills import this
 * rather than repeating the list.
 */
const UTILITY_CATEGORIES: BillCategory[] = ['electricity', 'water', 'wifi', 'internet'];

export function isUtilityCategory(category: BillCategory): boolean {
  return UTILITY_CATEGORIES.includes(category);
}

/* ------------------------------------------------------------------ */
/* lookups                                                             */
/* ------------------------------------------------------------------ */

export function billableMembers(state: AppState): Member[] {
  return activeMembers(state.members, '9999-12');
}

export function membersInScope(state: AppState, period: string): Member[] {
  return activeMembers(state.members, period);
}

export function memberById(state: AppState, id: string): Member | undefined {
  return state.members.find((member) => member.id === id);
}

export function currentMember(state: AppState): Member {
  return (
    memberById(state, state.currentMemberId) ??
    billableMembers(state)[0] ?? {
      id: 'm-none',
      name: '—',
      firstName: '—',
      initials: '—',
      roomId: '',
      role: 'member' as const,
      joinedAt: '',
      weight: 1,
    }
  );
}

export function landlord(state: AppState): Member | undefined {
  return state.members.find((member) => member.id === state.house.landlordId);
}

export function roomById(state: AppState, id: string): Room | undefined {
  return state.rooms.find((room) => room.id === id);
}

export function roomFor(state: AppState, member: Member | undefined): Room | undefined {
  return member ? roomById(state, member.roomId) : undefined;
}

export function memberName(state: AppState, id: string): string {
  return memberById(state, id)?.firstName ?? '—';
}

/* ------------------------------------------------------------------ */
/* allocation                                                          */
/* ------------------------------------------------------------------ */

export function allocateBill(state: AppState, bill: Bill, t: TFn): AllocationResult {
  return allocate(bill, state.members, state.rooms, t, state.lang);
}

export function shareFor(state: AppState, bill: Bill, memberId: string, t: TFn): Sen {
  const result = allocateBill(state, bill, t);
  return result.perMember[memberId]?.amountSen ?? 0;
}

/* ------------------------------------------------------------------ */
/* per-bill rows                                                       */
/* ------------------------------------------------------------------ */

export interface BillRow {
  bill: Bill;
  result: AllocationResult;
  memberId: string;
  shareSen: Sen;
  paidSen: Sen;
  outstandingSen: Sen;
  payState: PayState;
  billState: BillState;
  /** how late this member's share is; 0 once they have paid it */
  daysOverdue: number;
  /** how late the bill is for the house as a whole, whatever each member has paid */
  billDaysOverdue: number;
  daysUntilDue: number;
  /** house-wide paid ratio, 0..1 */
  paidRatio: number;
}

export function paidFor(bill: Bill, memberId: string): Sen {
  return sumSen(bill.payments.filter((p) => p.memberId === memberId).map((p) => p.amountSen));
}

export function paidForBill(bill: Bill): Sen {
  return sumSen(bill.payments.map((p) => p.amountSen));
}

/**
 * The bills that count towards the house ledger.
 *
 * This is the root every money figure flows through: the member totals, the
 * attention feed, the house summary and the landlord's view are all derived
 * from it. It therefore has to honour `forceEmpty` itself, otherwise the
 * demo's empty-state switch empties the bills list while the hero still
 * reports what the house owes.
 */
export function countedBills(state: AppState): Bill[] {
  if (state.forceEmpty) return [];
  return state.bills.filter((bill) => bill.sentToMembers && !bill.voidedAt);
}

type RowBase = Omit<BillRow, 'billState'>;

function rowBase(bill: Bill, result: AllocationResult, memberId: string): RowBase {
  const shareSen = result.perMember[memberId]?.amountSen ?? 0;
  const paidSen = paidFor(bill, memberId);
  const outstandingSen = Math.max(0, shareSen - paidSen);
  const payState: PayState =
    shareSen === 0 ? 'paid' : paidSen >= shareSen ? 'paid' : paidSen > 0 ? 'partial' : 'unpaid';
  return {
    bill,
    result,
    memberId,
    shareSen,
    paidSen,
    outstandingSen,
    payState,
    daysOverdue: payState === 'paid' ? 0 : Math.max(0, daysSince(bill.dueAt)),
    billDaysOverdue: Math.max(0, daysSince(bill.dueAt)),
    daysUntilDue: daysUntil(bill.dueAt),
    paidRatio: shareSen === 0 ? 1 : Math.min(1, paidSen / shareSen),
  };
}

function stateFromBases(bill: Bill, bases: RowBase[]): BillState {
  if (bill.voidedAt) return 'void';
  if (!bill.sentToMembers) return 'draft';
  const total = sumSen(bases.map((base) => base.shareSen));
  const paid = sumSen(bases.map((base) => base.paidSen));
  if (total > 0 && paid >= total) return 'paid';
  if (bases.some((base) => base.daysOverdue > 0)) return 'overdue';
  if (bases.some((base) => base.payState === 'partial')) return 'part_paid';
  return bases.some((base) => base.daysUntilDue <= 3) ? 'due_soon' : 'open';
}

/** The status of the bill as a whole, derived — never stored. */
export function billState(state: AppState, bill: Bill, result: AllocationResult): BillState {
  void state;
  return stateFromBases(bill, Object.keys(result.perMember).map((id) => rowBase(bill, result, id)));
}

export function billRow(
  state: AppState,
  bill: Bill,
  result: AllocationResult,
  memberId: string,
): BillRow {
  return (
    billRows(state, bill, result).find((row) => row.memberId === memberId) ?? {
      ...rowBase(bill, result, memberId),
      billState: stateFromBases(bill, [rowBase(bill, result, memberId)]),
    }
  );
}

export function billRows(
  state: AppState,
  bill: Bill,
  result: AllocationResult,
): BillRow[] {
  void state;
  const bases = Object.keys(result.perMember).map((memberId) => rowBase(bill, result, memberId));
  const billState = stateFromBases(bill, bases);
  return bases.map((base) => ({ ...base, billState }));
}

export function rowsFor(state: AppState, bill: Bill, t: TFn): BillRow[] {
  return billRows(state, bill, allocateBill(state, bill, t));
}

export function rowFor(state: AppState, bill: Bill, memberId: string, t: TFn): BillRow {
  const result = allocateBill(state, bill, t);
  return billRow(state, bill, result, memberId);
}

/* ------------------------------------------------------------------ */
/* house figures                                                       */
/* ------------------------------------------------------------------ */

export interface HouseTotals {
  billed: Sen;
  paid: Sen;
  outstanding: Sen;
  settledPct: number;
  billCount: number;
}

export function houseTotals(state: AppState): HouseTotals {
  const bills = countedBills(state);
  const billed = sumSen(bills.map((bill) => bill.amountSen));
  const paid = sumSen(bills.map((bill) => paidForBill(bill)));
  return {
    billed,
    paid,
    outstanding: Math.max(0, billed - paid),
    settledPct: billed === 0 ? 0 : (paid / billed) * 100,
    billCount: bills.length,
  };
}

/** The three figures the Home hero shows. Scoped to one member. */
export interface MemberTotals {
  paid: Sen;
  due: Sen;
  overdue: Sen;
  outstanding: Sen;
  shareTotal: Sen;
}

export function memberTotals(state: AppState, memberId: string, t: TFn): MemberTotals {
  const bills = countedBills(state);
  let paid = 0;
  let due = 0;
  let overdue = 0;
  let shareTotal = 0;
  for (const bill of bills) {
    const row = rowFor(state, bill, memberId, t);
    shareTotal += row.shareSen;
    paid += row.paidSen;
    overdue += row.daysOverdue > 0 ? row.outstandingSen : 0;
    due += row.daysOverdue > 0 ? 0 : row.outstandingSen;
  }
  return { paid, due, overdue, outstanding: due + overdue, shareTotal };
}

/** One row per outstanding share in the whole house, worst first. */
export interface AttentionItem {
  key: string;
  memberId: string;
  memberName: string;
  /** Initials for the row's avatar; empty when the member is gone. */
  memberInitials: string;
  bill: Bill;
  outstandingSen: Sen;
  daysOverdue: number;
  daysUntilDue: number;
  isLandlordRent: boolean;
}

export function attentionItems(state: AppState, t: TFn): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const bill of countedBills(state)) {
    for (const row of rowsFor(state, bill, t)) {
      if (row.outstandingSen <= 0) continue;
      const member = memberById(state, row.memberId);
      items.push({
        key: `${bill.id}:${row.memberId}`,
        memberId: row.memberId,
        memberName: member?.firstName ?? '—',
        memberInitials: member?.initials ?? '',
        bill,
        outstandingSen: row.outstandingSen,
        daysOverdue: row.daysOverdue,
        daysUntilDue: row.daysUntilDue,
        isLandlordRent: bill.category === 'rent',
      });
    }
  }
  return items.sort((a, b) => {
    if (a.daysOverdue !== b.daysOverdue) return b.daysOverdue - a.daysOverdue;
    if (a.isLandlordRent !== b.isLandlordRent) return a.isLandlordRent ? -1 : 1;
    return a.daysUntilDue - b.daysUntilDue;
  });
}

/** The current member's own outstanding shares, soonest first. */
export function myOutstanding(state: AppState, t: TFn): AttentionItem[] {
  return attentionItems(state, t).filter((item) => item.memberId === state.currentMemberId);
}

export interface HouseOverdue {
  totalSen: Sen;
  items: AttentionItem[];
  /** The longest anyone is behind, in days. */
  worstDays: number;
}

/**
 * Overdue money anywhere in the house, whoever owes it.
 *
 * The member-facing screens previously reported only the current member's
 * own overdue figure, so a tenant who had settled their own share in full
 * saw "Overdue RM 0.00" and had no idea a housemate was six days late on
 * rent. This is deliberately kept apart from the member's own total: it is
 * the house's problem, not a debt the reader has taken on, and the UI must
 * not present it as one.
 */
export function houseOverdue(state: AppState, t: TFn): HouseOverdue {
  const items = attentionItems(state, t).filter((item) => item.daysOverdue > 0);
  return {
    totalSen: sumSen(items.map((item) => item.outstandingSen)),
    items,
    worstDays: items.reduce((worst, item) => Math.max(worst, item.daysOverdue), 0),
  };
}

export function totalKwh(state: AppState): number {
  return state.rooms.reduce((total, room) => {
    if (!room.meter) return total;
    return total + Math.max(0, room.meter.currKwh - room.meter.prevKwh);
  }, 0);
}

/* ------------------------------------------------------------------ */
/* bills list                                                          */
/* ------------------------------------------------------------------ */

export function visibleBills(state: AppState): Bill[] {
  const list = state.forceEmpty ? [] : state.bills;
  return list.filter((bill) => {
    if (bill.voidedAt) return false;
    if (bill.sentToMembers) return true;
    // a draft is private to the person who created it
    return bill.createdBy === state.currentMemberId;
  });
}

export function latestPeriod(state: AppState): string {
  const periods = visibleBills(state).map((bill) => bill.period).sort();
  return periods[periods.length - 1] ?? '2026-08';
}

/* ------------------------------------------------------------------ */
/* repairs                                                             */
/* ------------------------------------------------------------------ */

export function visibleTickets(state: AppState): Ticket[] {
  return state.forceEmpty ? [] : [...state.tickets].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
}

export function openTickets(state: AppState): Ticket[] {
  return visibleTickets(state).filter((ticket) => ticket.status !== 'resolved');
}

export function resolvedTickets(state: AppState): Ticket[] {
  return visibleTickets(state).filter((ticket) => ticket.status === 'resolved');
}

/* ------------------------------------------------------------------ */
/* reminders                                                           */
/* ------------------------------------------------------------------ */

export function myReminders(state: AppState): Reminder[] {
  return state.forceEmpty
    ? []
    : state.reminders
        .filter((reminder) => reminder.memberId === state.currentMemberId)
        .sort((a, b) => b.at.localeCompare(a.at));
}

export function unreadCount(state: AppState): number {
  return myReminders(state).filter((reminder) => !reminder.read).length;
}

export function nextReminder(state: AppState): Reminder | undefined {
  return myReminders(state).find((reminder) => !reminder.read);
}

/* ------------------------------------------------------------------ */
/* house activity feed                                                  */
/* ------------------------------------------------------------------ */

/** One row in the house activity feed, with the actor already resolved. */
export interface ActivityRow {
  entry: ActivityEntry;
  actor: Member | undefined;
  actorName: string;
  actorInitials: string;
}

/**
 * Everything that has happened in the house, newest first. The actor is
 * resolved here rather than in the view so a screen never has to guess a name
 * from an id, and a deleted member degrades to "Unknown" instead of blank.
 *
 * Respects `forceEmpty` like the bills, tickets and reminders lists do, so the
 * demo's empty-state switch empties the whole house in one go.
 */
export function activityFeed(state: AppState): ActivityRow[] {
  if (state.forceEmpty) return [];
  return [...state.activity]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((entry) => {
      const actor = memberById(state, entry.actor);
      return {
        entry,
        actor,
        actorName: actor?.firstName ?? '—',
        actorInitials: actor?.initials ?? '',
      };
    });
}

/* ------------------------------------------------------------------ */
/* landlord view — rent and repairs only, never a utility breakdown    */
/* ------------------------------------------------------------------ */

export interface LandlordTenant {
  member: Member;
  room: Room | undefined;
  shareSen: Sen;
  paidSen: Sen;
  outstandingSen: Sen;
  state: PayState | 'unpaid';
}

export interface LandlordView {
  rentBills: Bill[];
  rentBilled: Sen;
  rentCollected: Sen;
  rentOutstanding: Sen;
  outstandingTenantCount: number;
  tenants: LandlordTenant[];
  utilityTotalSen: Sen;
  openRepairs: Ticket[];
}

export function landlordView(state: AppState, t: TFn): LandlordView {
  const rentBills = countedBills(state).filter((bill) => bill.category === 'rent');
  const rentBilled = sumSen(rentBills.map((bill) => bill.amountSen));
  const rentCollected = sumSen(rentBills.map((bill) => paidForBill(bill)));
  const tenants: LandlordTenant[] = [];
  for (const member of billableMembers(state)) {
    let shareSen = 0;
    let paidSen = 0;
    for (const bill of rentBills) {
      const row = rowFor(state, bill, member.id, t);
      shareSen += row.shareSen;
      paidSen += row.paidSen;
    }
    const outstandingSen = Math.max(0, shareSen - paidSen);
    tenants.push({
      member,
      room: roomFor(state, member),
      shareSen,
      paidSen,
      outstandingSen,
      state: outstandingSen === 0 ? 'paid' : paidSen > 0 ? 'partial' : 'unpaid',
    });
  }
  const utilityTotalSen = sumSen(
    countedBills(state)
      .filter((bill) => isUtilityCategory(bill.category))
      .map((bill) => bill.amountSen),
  );
  return {
    rentBills,
    rentBilled,
    rentCollected,
    rentOutstanding: Math.max(0, rentBilled - rentCollected),
    outstandingTenantCount: tenants.filter((tenant) => tenant.outstandingSen > 0).length,
    tenants,
    utilityTotalSen,
    openRepairs: openTickets(state),
  };
}

/* ------------------------------------------------------------------ */
/* statement                                                           */
/* ------------------------------------------------------------------ */

export interface StatementLine {
  bill: Bill;
  shareSen: Sen;
  paidSen: Sen;
  outstandingSen: Sen;
  state: PayState;
}

export function statementFor(state: AppState, memberId: string, t: TFn): StatementLine[] {
  return countedBills(state)
    .map((bill) => {
      const row = rowFor(state, bill, memberId, t);
      return {
        bill,
        shareSen: row.shareSen,
        paidSen: row.paidSen,
        outstandingSen: row.outstandingSen,
        state: row.payState,
      };
    })
    .sort((a, b) => a.bill.dueAt.localeCompare(b.bill.dueAt));
}

/* ------------------------------------------------------------------ */
/* formatting helpers used by several screens                           */
/* ------------------------------------------------------------------ */

export function billTotalLabel(bill: Bill): string {
  return ringgit(bill.amountSen);
}

export function allocationForRows(
  state: AppState,
  bill: Bill,
  t: TFn,
): { member: Member; allocation: MemberAllocation }[] {
  const result = allocateBill(state, bill, t);
  return membersInScope(state, bill.period)
    .map((member) => ({ member, allocation: result.perMember[member.id] }))
    .filter((row) => Boolean(row.allocation));
}
