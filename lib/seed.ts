import { NOW_ISO } from './dates';
import type { AppState, Localized } from './types';

function l(en: string, bm: string): Localized {
  return { en, bm };
}

export const SEED_VERSION = 5;

/**
 * The seeded house: Rumah Kalantan 2, Cyberjaya.
 *
 * Every number here is chosen to make the demo tell one coherent story rather
 * than to look tidy:
 *  - the room sub-meters read 268 / 194 / 121 kWh with 44 kWh in the common
 *    area, which is 627 kWh and makes the TNB split genuinely different per
 *    person;
 *  - the electricity bill of RM 412.80 works out to 95.46 / 95.46 / 134.97 /
 *    86.91, and the two leftover sen land on the two largest shares;
 *  - rent is unpaid for exactly one member, which is what makes the house
 *    overdue by six days without making anybody's own numbers wrong;
 *  - the current member's own figures are Paid RM 594.56, Due RM 41.40,
 *    Overdue RM 0.00.
 */
export function createSeedState(): AppState {
  return {
    version: SEED_VERSION,
    lang: 'en',
    currentMemberId: 'm-aiman',
    demoRole: 'member',
    house: {
      id: 'h-kalantan2',
      name: 'Rumah Kalantan 2',
      address: 'Jalan Kalantan 2/1, Taman Cyberjaya',
      city: 'Cyberjaya',
      landlordId: 'm-rahmat',
      rentDueDay: 9,
      reminderCadence: [3, 1, 0],
      defaultMethod: 'submeter',
      createdAt: '2026-05-04T10:00:00+08:00',
    },
    members: [
      {
        id: 'm-aiman',
        name: 'Aiman Hakimi',
        firstName: 'Aiman',
        initials: 'AH',
        roomId: 'r1',
        role: 'owner',
        joinedAt: '2026-05-04',
        weight: 3,
      },
      {
        id: 'm-nurul',
        name: 'Nurul Izzati',
        firstName: 'Nurul',
        initials: 'NI',
        roomId: 'r1',
        role: 'member',
        joinedAt: '2026-05-04',
        weight: 2,
      },
      {
        id: 'm-kavin',
        name: 'Kavintharan S.',
        firstName: 'Kavintharan',
        initials: 'KS',
        roomId: 'r2',
        role: 'member',
        joinedAt: '2026-06-01',
        weight: 1,
      },
      {
        id: 'm-wong',
        name: 'Wong Ye Zu',
        firstName: 'Wong',
        initials: 'WY',
        roomId: 'r3',
        role: 'member',
        joinedAt: '2026-07-15',
        weight: 2,
      },
      {
        id: 'm-rahmat',
        name: 'Encik Rahmat',
        firstName: 'Encik Rahmat',
        initials: 'ER',
        roomId: 'rc',
        role: 'landlord',
        joinedAt: '2026-05-04',
        weight: 0,
      },
    ],
    rooms: [
      { id: 'r1', name: 'Bilik 1', rentSen: 90000, meter: { prevKwh: 1842, currKwh: 2110 } },
      { id: 'r2', name: 'Bilik 2', rentSen: 85000, meter: { prevKwh: 1205, currKwh: 1399 } },
      { id: 'r3', name: 'Bilik 3', rentSen: 65000, meter: { prevKwh: 968, currKwh: 1089 } },
      { id: 'rc', name: 'Common area', rentSen: null, meter: { prevKwh: 630, currKwh: 674 }, isCommon: true },
    ],
    bills: [
      {
        id: 'b-rent',
        category: 'rent',
        title: l('Rent', 'Sewa'),
        payee: l('Encik Rahmat', 'Encik Rahmat'),
        period: '2026-08',
        amountSen: 240000,
        issuedAt: '2026-08-25',
        dueAt: '2026-09-09',
        method: 'fixed',
        fixedByRoomSen: { r1: 90000, r2: 85000, r3: 65000 },
        payments: [
          { id: 'p-r-1', memberId: 'm-aiman', amountSen: 45000, paidAt: '2026-09-01T19:20:00+08:00', method: 'bank', recordedBy: 'm-aiman' },
          { id: 'p-r-2', memberId: 'm-nurul', amountSen: 45000, paidAt: '2026-09-01T19:22:00+08:00', method: 'duitnow', recordedBy: 'm-nurul' },
          { id: 'p-r-3', memberId: 'm-wong', amountSen: 65000, paidAt: '2026-09-02T10:05:00+08:00', method: 'bank', recordedBy: 'm-wong' },
        ],
        sentToMembers: true,
        createdBy: 'm-aiman',
        createdAt: '2026-08-25T09:00:00+08:00',
        note: l('Sent by bank transfer. Receipt in the group chat.', 'Dihantar melalui pindahan bank. Resit ada dalam kumpulan sembang.'),
      },
      {
        id: 'b-tnb',
        category: 'electricity',
        title: l('Electricity · TNB', 'Elektrik · TNB'),
        payee: l('Tenaga Nasional Berhad', 'Tenaga Nasional Berhad'),
        period: '2026-08',
        amountSen: 41280,
        issuedAt: '2026-09-01',
        dueAt: '2026-09-10',
        method: 'submeter',
        payments: [
          { id: 'p-t-1', memberId: 'm-aiman', amountSen: 9546, paidAt: '2026-09-08T21:14:00+08:00', method: 'duitnow', recordedBy: 'm-aiman' },
          { id: 'p-t-2', memberId: 'm-nurul', amountSen: 9546, paidAt: '2026-09-08T21:18:00+08:00', method: 'duitnow', recordedBy: 'm-nurul' },
          { id: 'p-t-3', memberId: 'm-kavin', amountSen: 13497, paidAt: '2026-09-09T08:40:00+08:00', method: 'household_fund', recordedBy: 'm-aiman' },
          { id: 'p-t-4', memberId: 'm-wong', amountSen: 8691, paidAt: '2026-09-08T22:02:00+08:00', method: 'duitnow', recordedBy: 'm-wong' },
        ],
        sentToMembers: true,
        createdBy: 'm-aiman',
        createdAt: '2026-09-01T12:30:00+08:00',
        receiptPhoto: 'IMG_1987',
        note: l('Sub-meter readings photographed on 1 Sep.', 'Gambar bacaan submeter diambil pada 1 Sep.'),
      },
      {
        id: 'b-unifi',
        category: 'wifi',
        title: l('Wi-Fi · Unifi', 'Wi-Fi · Unifi'),
        payee: l('Unifi (TM)', 'Unifi (TM)'),
        period: '2026-08',
        amountSen: 13000,
        issuedAt: '2026-09-02',
        dueAt: '2026-09-15',
        method: 'equal',
        payments: [
          { id: 'p-u-1', memberId: 'm-aiman', amountSen: 3250, paidAt: '2026-09-05T11:00:00+08:00', method: 'duitnow', recordedBy: 'm-aiman' },
          { id: 'p-u-2', memberId: 'm-nurul', amountSen: 3250, paidAt: '2026-09-05T11:03:00+08:00', method: 'duitnow', recordedBy: 'm-nurul' },
          { id: 'p-u-3', memberId: 'm-kavin', amountSen: 3250, paidAt: '2026-09-05T12:20:00+08:00', method: 'bank', recordedBy: 'm-kavin' },
          { id: 'p-u-4', memberId: 'm-wong', amountSen: 3250, paidAt: '2026-09-05T13:45:00+08:00', method: 'duitnow', recordedBy: 'm-wong' },
        ],
        sentToMembers: true,
        createdBy: 'm-nurul',
        createdAt: '2026-09-02T09:15:00+08:00',
      },
      {
        id: 'b-water',
        category: 'water',
        title: l('Water · Air Selangor', 'Air · Air Selangor'),
        payee: l('Air Selangor', 'Air Selangor'),
        period: '2026-08',
        amountSen: 4560,
        issuedAt: '2026-09-03',
        dueAt: '2026-09-18',
        method: 'equal',
        payments: [
          { id: 'p-w-1', memberId: 'm-kavin', amountSen: 1140, paidAt: '2026-09-06T20:10:00+08:00', method: 'cash', recordedBy: 'm-kavin' },
          { id: 'p-w-2', memberId: 'm-wong', amountSen: 1140, paidAt: '2026-09-06T20:12:00+08:00', method: 'cash', recordedBy: 'm-wong' },
        ],
        sentToMembers: true,
        createdBy: 'm-wong',
        createdAt: '2026-09-03T16:00:00+08:00',
      },
      {
        id: 'b-groceries',
        category: 'groceries',
        title: l('Groceries', 'Runcit'),
        payee: l('Aiman Hakimi', 'Aiman Hakimi'),
        period: '2026-08',
        amountSen: 18640,
        issuedAt: '2026-09-04',
        dueAt: '2026-09-20',
        method: 'equal',
        payments: [
          { id: 'p-g-1', memberId: 'm-aiman', amountSen: 1660, paidAt: '2026-09-10T20:12:00+08:00', method: 'household_fund', recordedBy: 'm-aiman' },
          { id: 'p-g-2', memberId: 'm-nurul', amountSen: 1660, paidAt: '2026-09-10T20:14:00+08:00', method: 'household_fund', recordedBy: 'm-nurul' },
          { id: 'p-g-3', memberId: 'm-kavin', amountSen: 4660, paidAt: '2026-09-10T21:00:00+08:00', method: 'cash', recordedBy: 'm-kavin' },
          { id: 'p-g-4', memberId: 'm-wong', amountSen: 4660, paidAt: '2026-09-10T21:02:00+08:00', method: 'cash', recordedBy: 'm-wong' },
        ],
        sentToMembers: true,
        createdBy: 'm-aiman',
        createdAt: '2026-09-04T18:30:00+08:00',
        note: l('Bought at Pasar Borong. Split four ways.', 'Dibeli di Pasar Borong. Dibahagi empat.')
      },
    ],
    tickets: [
      {
        id: 't-aircon',
        title: l('Air-con leaking in Bilik 2', 'Penyaman udara bocor di Bilik 2'),
        description: l(
          'Water is dripping from the wall unit onto the desk and the floor is damp. It started after the weekend.',
          'Air menitis daripada unit dinding ke atas meja dan lantai jadi lembap. Bermula hujung minggu lepas.',
        ),
        category: 'aircon',
        roomId: 'r2',
        photo: 'IMG_2041',
        status: 'resolved',
        reportedBy: 'm-aiman',
        reportedAt: '2026-09-03T20:15:00+08:00',
        activity: [
          { id: 'ta-1', at: '2026-09-03T20:15:00+08:00', by: 'm-aiman', to: 'reported' },
          { id: 'ta-2', at: '2026-09-04T08:30:00+08:00', by: 'm-rahmat', to: 'acknowledged', note: l('Seen. Contractor booked.', 'Telah lihat. Kontraktor ditempah.') },
          { id: 'ta-3', at: '2026-09-06T14:00:00+08:00', by: 'm-rahmat', to: 'in_progress' },
          { id: 'ta-4', at: '2026-09-09T17:45:00+08:00', by: 'm-rahmat', to: 'resolved', note: l('Pipe replaced, tested for two hours.', 'Paip ditukar, diuji selama dua jam.') },
        ],
      },
      {
        id: 't-window',
        title: l('Window latch will not lock', 'Tutup tingkap tidak boleh dikunci'),
        description: l(
          'The latch on the Bilik 3 window spins without catching, so the window does not lock.',
          'Tutup tingkap Bilik 3 berputar tanpa mengunci, jadi tingkap itu tidak berkunci.',
        ),
        category: 'structural',
        roomId: 'r3',
        photo: 'IMG_2088',
        status: 'acknowledged',
        reportedBy: 'm-wong',
        reportedAt: '2026-09-10T18:40:00+08:00',
        activity: [
          { id: 'ta-5', at: '2026-09-10T18:40:00+08:00', by: 'm-wong', to: 'reported' },
          { id: 'ta-6', at: '2026-09-11T09:05:00+08:00', by: 'm-rahmat', to: 'acknowledged', note: l('Handyman coming next week.', 'Tukang servis akan datang minggu depan.') },
        ],
      },
      {
        id: 't-heater',
        title: l('Water heater not getting hot', 'Pemanas air tidak panas'),
        description: l(
          'The shower runs cold even after ten minutes. It started on Sunday night.',
          'Air pancuran stayed sejuk walaupun selepas sepuluh minit. Bermula pada malam Ahad.',
        ),
        category: 'appliance',
        roomId: 'r1',
        photo: 'IMG_2103',
        status: 'reported',
        reportedBy: 'm-nurul',
        reportedAt: '2026-09-14T22:05:00+08:00',
        activity: [{ id: 'ta-7', at: '2026-09-14T22:05:00+08:00', by: 'm-nurul', to: 'reported' }],
      },
    ],
    reminders: [
      {
        id: 'rem-1',
        kind: 'maths',
        at: '2026-09-01T12:35:00+08:00',
        read: false,
        memberId: 'm-aiman',
        billId: 'b-tnb',
      },
      {
        id: 'rem-2',
        kind: 'payment_recorded',
        at: '2026-09-10T20:15:00+08:00',
        read: true,
        memberId: 'm-aiman',
        billId: 'b-groceries',
        amountSen: 1660,
      },
      {
        id: 'rem-3',
        kind: 'due_soon',
        at: '2026-09-15T08:00:00+08:00',
        read: false,
        memberId: 'm-aiman',
        billId: 'b-water',
        amountSen: 1140,
        days: 3,
      },
      {
        id: 'rem-4',
        kind: 'subscription',
        at: '2026-09-15T08:30:00+08:00',
        read: false,
        memberId: 'm-aiman',
      },
      // A repair reminder per ticket, so the repairs a member is part of never
      // go unmentioned. Two stay unread because those tickets are still open.
      {
        id: 'rem-5',
        kind: 'repair',
        at: '2026-09-03T20:16:00+08:00',
        read: true,
        memberId: 'm-aiman',
        ticketId: 't-aircon',
      },
      {
        id: 'rem-6',
        kind: 'repair',
        at: '2026-09-10T18:41:00+08:00',
        read: false,
        memberId: 'm-aiman',
        ticketId: 't-window',
      },
      {
        id: 'rem-7',
        kind: 'repair',
        at: '2026-09-14T22:06:00+08:00',
        read: false,
        memberId: 'm-aiman',
        ticketId: 't-heater',
      },
      // The one genuinely overdue share in the house. It is scoped to
      // Kavintharan because that reminder reads "RM 850.00 overdue from
      // Kavintharan": scoping it to anyone who has already paid would print
      // their own zero. Six days is measured from the pinned demo now, so it
      // stays correct without drifting.
      {
        id: 'rem-8',
        kind: 'overdue',
        at: '2026-09-09T08:00:00+08:00',
        read: false,
        memberId: 'm-kavin',
        billId: 'b-rent',
        amountSen: 85000,
        days: 6,
      },
    ],
    activity: [
      { id: 'ac-1', at: '2026-09-01T12:31:00+08:00', actor: 'm-aiman', kind: 'bill', summary: 'Electricity · TNB shared with 4 members' },
      { id: 'ac-2', at: '2026-09-08T21:15:00+08:00', actor: 'm-aiman', kind: 'payment', summary: 'Aiman recorded RM 95.46 for Electricity · TNB' },
      { id: 'ac-3', at: '2026-09-10T20:13:00+08:00', actor: 'm-aiman', kind: 'payment', summary: 'Nurul recorded RM 16.60 for Groceries' },
      { id: 'ac-4', at: '2026-09-10T18:41:00+08:00', actor: 'm-wong', kind: 'repair', summary: 'Wong Ye Zu reported “Window latch will not lock”' },
      { id: 'ac-5', at: '2026-09-14T22:06:00+08:00', actor: 'm-nurul', kind: 'repair', summary: 'Nurul Izzati reported “Water heater not getting hot”' },
      { id: 'ac-6', at: '2026-09-15T08:31:00+08:00', actor: 'm-aiman', kind: 'house', summary: 'House Pass reminder queued for 1 Oct 2026' },
    ],
    subscription: {
      id: 'sub-house-pass',
      plan: 'house_pass',
      priceSen: 900,
      renewalAt: '2026-10-01',
      memberIds: ['m-aiman', 'm-nurul', 'm-kavin', 'm-wong'],
    },
    forceEmpty: false,
    storageError: false,
    bootstrapped: true,
  };
}

export const SEED_NOW = NOW_ISO;
