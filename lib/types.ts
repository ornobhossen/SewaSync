/**
 * SewaSync domain types.
 *
 * Money is ALWAYS integer sen. `Sen` is a plain number because sen values in
 * this app stay far below Number.MAX_SAFE_INTEGER — no floating point is used
 * for money anywhere in the codebase.
 */

export type Sen = number;

export type Lang = 'en' | 'bm';

export type Role = 'owner' | 'leader' | 'member' | 'landlord';

export type SplitMethod = 'submeter' | 'weight' | 'equal' | 'fixed';

export type BillCategory =
  | 'electricity'
  | 'water'
  | 'wifi'
  | 'rent'
  | 'internet'
  | 'groceries'
  | 'other';

export type PayState = 'unpaid' | 'partial' | 'paid';

export type BillState =
  | 'draft'
  | 'paid'
  | 'part_paid'
  | 'due_soon'
  | 'open'
  | 'overdue'
  | 'void';

export type TicketStatus = 'reported' | 'acknowledged' | 'in_progress' | 'resolved';

export type TicketCategory =
  | 'aircon'
  | 'plumbing'
  | 'electrical'
  | 'appliance'
  | 'structural'
  | 'other';

export type DemoRole = 'member' | 'landlord';

export interface Localized {
  en: string;
  bm: string;
}

export interface Member {
  id: string;
  name: string;
  firstName: string;
  initials: string;
  roomId: string;
  role: Role;
  joinedAt: string;
  /** weight for the 'weight' split method, normalised at allocation time */
  weight: number;
  /** a member with no meter in a metered house is labelled as an assumption */
  noMeter?: boolean;
  leftAt?: string;
}

export interface Room {
  id: string;
  name: string;
  /** per-room monthly rent in sen; null for the common area */
  rentSen: Sen | null;
  /** sub-meter readings. null means the room has no meter. */
  meter: { prevKwh: number; currKwh: number } | null;
  isCommon?: boolean;
}

export interface PaymentMethodId {
  id: 'duitnow' | 'bank' | 'cash' | 'household_fund';
  en: string;
  bm: string;
}

export interface Payment {
  id: string;
  memberId: string;
  amountSen: Sen;
  paidAt: string;
  method: PaymentMethodId['id'];
  recordedBy: string;
  note?: string;
}

export interface Bill {
  id: string;
  category: BillCategory;
  title: Localized;
  payee: Localized;
  period: string; // '2026-08'
  amountSen: Sen;
  issuedAt: string; // ISO date
  dueAt: string; // ISO date
  method: SplitMethod;
  weights?: Record<string, number>;
  fixedByRoomSen?: Record<string, Sen>;
  payments: Payment[];
  sentToMembers: boolean;
  createdBy: string;
  createdAt: string;
  note?: Localized;
  receiptPhoto?: string;
  voidedAt?: string;
}

export interface TicketActivity {
  id: string;
  at: string;
  by: string;
  to: TicketStatus;
  note?: Localized;
}

export interface Ticket {
  id: string;
  title: Localized;
  description: Localized;
  category: TicketCategory;
  roomId: string;
  photo: string;
  status: TicketStatus;
  reportedBy: string;
  reportedAt: string;
  activity: TicketActivity[];
}

export type ReminderKind =
  | 'overdue'
  | 'due_soon'
  | 'maths'
  | 'subscription'
  | 'sent'
  | 'payment_recorded'
  | 'repair'
  | 'bill_sent';

export interface Reminder {
  id: string;
  kind: ReminderKind;
  at: string;
  read: boolean;
  /** the member this reminder is scoped to; the landlord is never a target */
  memberId: string;
  billId?: string;
  amountSen?: Sen;
  days?: number;
  ticketId?: string;
  /** true when the entry is the read-only log of a reminder that was sent */
  sentLog?: boolean;
}

export interface House {
  id: string;
  name: string;
  address: string;
  city: string;
  landlordId: string;
  rentDueDay: number;
  reminderCadence: number[];
  defaultMethod: SplitMethod;
  createdAt: string;
}

export interface Subscription {
  id: string;
  plan: 'house_pass';
  priceSen: Sen;
  renewalAt: string;
  memberIds: string[];
}

export interface AppState {
  version: number;
  lang: Lang;
  currentMemberId: string;
  demoRole: DemoRole;
  house: House;
  members: Member[];
  rooms: Room[];
  bills: Bill[];
  tickets: Ticket[];
  reminders: Reminder[];
  activity: ActivityEntry[];
  subscription: Subscription;
  forceEmpty: boolean;
  /** true when the saved demo data on this device could not be read */
  storageError: boolean;
  bootstrapped: boolean;
}

export interface ActivityEntry {
  id: string;
  at: string;
  actor: string;
  kind: 'payment' | 'reminder' | 'bill' | 'repair' | 'house';
  summary: string;
  detail?: string;
}

/* ------------------------------------------------------------------ */
/* Allocation engine output                                            */
/* ------------------------------------------------------------------ */

export type WarningCode =
  | 'reading_backwards'
  | 'no_usage_equal_fallback'
  | 'zero_usage_room'
  | 'no_meter_assumption'
  | 'no_meter_house'
  | 'fixed_total_mismatch'
  | 'partial_period_member';

export interface AllocationWarning {
  code: WarningCode;
  vars: Record<string, string | number>;
  /** roomId for room-scoped warnings */
  roomId?: string;
  memberId?: string;
}

export type DerivationRowKind =
  | 'room_meter'
  | 'room_shared'
  | 'common_share'
  | 'no_meter'
  | 'zero_usage'
  | 'subtotal_usage'
  | 'share_of_bill'
  | 'charge'
  | 'rounding'
  | 'equal'
  | 'weight'
  | 'fixed';

export interface DerivationRow {
  kind: DerivationRowKind;
  label: string;
  /** the arithmetic shown on the right, e.g. '44 ÷ 4' */
  expr?: string;
  value: string;
  emphasis?: boolean;
  total?: boolean;
}

export interface MemberAllocation {
  memberId: string;
  amountSen: Sen;
  kwh: number;
  kwhFromRoom: number;
  kwhFromCommon: number;
  roomId: string;
  roomPax: number;
  sharePercent: number;
  rawSen: number;
  remainder: number;
  /** +1 or -1 sen applied by largest-remainder distribution */
  roundingSen: number;
  assumption: boolean;
  zeroUsage: boolean;
  derivation: DerivationRow[];
}

export interface AllocationResult {
  method: SplitMethod;
  requestedMethod: SplitMethod;
  memberCount: number;
  perMember: Record<string, MemberAllocation>;
  roomKwh: Record<string, number>;
  commonKwh: number;
  totalKwh: number;
  /** equal split of the same bill, always computed for the comparison chip */
  equal: Record<string, Sen>;
  roundingTotalSen: number;
  warnings: AllocationWarning[];
  fallbackToEqual: boolean;
}
