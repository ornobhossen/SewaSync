'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import { NOW_ISO } from './dates';
import { ringgit } from './money';
import { createSeedState, SEED_VERSION } from './seed';
import { translator, type Key } from './i18n';
import type {
  ActivityEntry,
  AppState,
  Bill,
  DemoRole,
  House,
  Lang,
  Member,
  Payment,
  Reminder,
  Room,
  Ticket,
  TicketActivity,
  TicketStatus,
} from './types';

const STORAGE_KEY = `sewasync:v${SEED_VERSION}`;

/* ------------------------------------------------------------------ */
/* actions                                                             */
/* ------------------------------------------------------------------ */

export type Action =
  | { type: 'hydrate'; state: AppState }
  | { type: 'setLang'; lang: Lang }
  | { type: 'setRole'; role: DemoRole }
  | { type: 'toggleEmpty' }
  | { type: 'reset' }
  | { type: 'addBill'; bill: Bill; memberIds: string[] }
  | { type: 'recordPayment'; billId: string; payment: Payment; billTitle: string }
  | { type: 'setBillMethod'; billId: string; method: Bill['method']; weights?: Record<string, number> }
  | { type: 'voidBill'; billId: string }
  | { type: 'deleteDraft'; billId: string }
  | { type: 'addTicket'; ticket: Ticket }
  | { type: 'setTicketStatus'; ticketId: string; status: TicketStatus; note?: { en: string; bm: string } }
  | { type: 'readReminder'; reminderId: string }
  | { type: 'readAllReminders' }
  | { type: 'logReminderSent'; memberId: string; billId: string; amountSen: number }
  | { type: 'updateRoom'; roomId: string; patch: Partial<Room> }
  | { type: 'updateWeights'; weights: Record<string, number> }
  | { type: 'renounce'; memberId: string }
  | { type: 'createHouse'; house: House; rooms: Room[]; members: Member[]; ownerId: string }
  | { type: 'joinHouse'; member: Member };

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

function activity(state: AppState, entry: Omit<ActivityEntry, 'id' | 'at'>): ActivityEntry {
  return { id: uid('ac'), at: NOW_ISO, ...entry };
}

/**
 * The name an activity entry should read with. The feed is read by people, not
 * by code, so entries are written the way the seed writes them: "Aiman
 * recorded RM 95.46 for Electricity · TNB" rather than "m-aiman:9546".
 */
function nameOf(state: AppState, memberId: string): string {
  return state.members.find((member) => member.id === memberId)?.firstName ?? '—';
}

/** The full name, for entries the seed spells out in full. */
function fullNameOf(state: AppState, memberId: string): string {
  return state.members.find((member) => member.id === memberId)?.name ?? '—';
}

function memberCount(n: number): string {
  return `${n} member${n === 1 ? '' : 's'}`;
}

/**
 * How a ticket status reads in the house feed.
 *
 * The activity feed stores finished sentences rather than keys, so these
 * words are written out here. They must match `rep.reported` and friends, or
 * the feed and the repair screens would describe the same status with
 * different words.
 */
const STATUS_WORDS: Record<TicketStatus, string> = {
  reported: 'Reported',
  acknowledged: 'Acknowledged',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

function reminder(entry: Omit<Reminder, 'id' | 'at' | 'read'> & { id?: string }): Reminder {
  return { id: entry.id ?? uid('rem'), at: NOW_ISO, read: false, ...entry };
}

/* ------------------------------------------------------------------ */
/* reducer                                                             */
/* ------------------------------------------------------------------ */

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return action.state;

    case 'setLang':
      return { ...state, lang: action.lang };

    case 'setRole':
      return { ...state, demoRole: action.role };

    case 'toggleEmpty':
      return { ...state, forceEmpty: !state.forceEmpty };

    case 'reset':
      return { ...createSeedState(), lang: state.lang, demoRole: state.demoRole };

    case 'addBill': {
      const bills = [action.bill, ...state.bills];
      if (!action.bill.sentToMembers) {
        return { ...state, bills };
      }
      const reminders = [
        ...state.reminders,
        ...action.memberIds.map((memberId) =>
          reminder({
            kind: action.bill.method === 'equal' ? 'bill_sent' : 'maths',
            memberId,
            billId: action.bill.id,
          }),
        ),
      ];
      const log = activity(state, {
        actor: action.bill.createdBy,
        kind: 'bill',
        summary: `${action.bill.title.en} shared with ${memberCount(action.memberIds.length)}`,
        detail: `split:${action.bill.method}`,
      });
      return { ...state, bills, reminders, activity: [log, ...state.activity] };
    }

    case 'recordPayment': {
      const bills = state.bills.map((bill) =>
        bill.id === action.billId ? { ...bill, payments: [...bill.payments, action.payment] } : bill,
      );
      const reminders = [
        ...state.reminders,
        reminder({
          kind: 'payment_recorded',
          memberId: action.payment.memberId,
          billId: action.billId,
          amountSen: action.payment.amountSen,
        }),
      ];
      const log = activity(state, {
        actor: action.payment.recordedBy,
        kind: 'payment',
        summary: `${nameOf(state, action.payment.memberId)} recorded ${ringgit(action.payment.amountSen)} for ${action.billTitle}`,
        detail: `${action.payment.memberId}:${action.payment.amountSen}`,
      });
      return { ...state, bills, reminders, activity: [log, ...state.activity] };
    }

    case 'setBillMethod':
      return {
        ...state,
        bills: state.bills.map((bill) =>
          bill.id === action.billId
            ? { ...bill, method: action.method, weights: action.weights ?? bill.weights }
            : bill,
        ),
      };

    case 'voidBill':
      return {
        ...state,
        bills: state.bills.map((bill) =>
          bill.id === action.billId ? { ...bill, voidedAt: NOW_ISO, sentToMembers: false } : bill,
        ),
      };

    case 'deleteDraft':
      return { ...state, bills: state.bills.filter((bill) => bill.id !== action.billId) };

    case 'addTicket': {
      const reminders = [
        ...state.reminders,
        reminder({ kind: 'repair', memberId: action.ticket.reportedBy, ticketId: action.ticket.id }),
      ];
      const log = activity(state, {
        actor: action.ticket.reportedBy,
        kind: 'repair',
        summary: `${fullNameOf(state, action.ticket.reportedBy)} reported “${action.ticket.title.en}”`,
        detail: 'reported',
      });
      return {
        ...state,
        tickets: [action.ticket, ...state.tickets],
        reminders,
        activity: [log, ...state.activity],
      };
    }

    case 'setTicketStatus': {
      const before = state.tickets.find((item) => item.id === action.ticketId);
      const tickets = state.tickets.map((ticket) => {
        if (ticket.id !== action.ticketId) return ticket;
        const entry: TicketActivity = {
          id: uid('ta'),
          at: NOW_ISO,
          by: state.currentMemberId,
          to: action.status,
          note: action.note,
        };
        return { ...ticket, status: action.status, activity: [...ticket.activity, entry] };
      });
      const ticket = before;
      const reminders =
        ticket && ticket.reportedBy !== state.currentMemberId
          ? [
              ...state.reminders,
              reminder({ kind: 'repair', memberId: ticket.reportedBy, ticketId: ticket.id }),
            ]
          : state.reminders;
      // A status change is a house event, so it belongs in the house feed too.
      // Only a real move is logged: re-saying the current status is not news.
      const changed = ticket !== undefined && ticket.status !== action.status;
      const nextActivity = changed
        ? [
            activity(state, {
              actor: state.currentMemberId,
              kind: 'repair',
              summary: `${fullNameOf(state, state.currentMemberId)} moved “${ticket.title.en}” to ${STATUS_WORDS[action.status]}`,
              detail: `${ticket.id}:${action.status}`,
            }),
            ...state.activity,
          ]
        : state.activity;
      return { ...state, tickets, reminders, activity: nextActivity };
    }

    case 'readReminder':
      return {
        ...state,
        reminders: state.reminders.map((reminderItem) =>
          reminderItem.id === action.reminderId ? { ...reminderItem, read: true } : reminderItem,
        ),
      };

    case 'readAllReminders':
      return {
        ...state,
        reminders: state.reminders.map((reminderItem) =>
          reminderItem.memberId === state.currentMemberId ? { ...reminderItem, read: true } : reminderItem,
        ),
      };

    case 'logReminderSent': {
      const bill = state.bills.find((item) => item.id === action.billId);
      const log = activity(state, {
        actor: state.currentMemberId,
        kind: 'reminder',
        summary: bill?.title.en ?? 'reminder',
        detail: `${action.memberId}:${action.amountSen}`,
      });
      const reminders = [
        ...state.reminders,
        reminder({
          kind: 'sent',
          memberId: action.memberId,
          billId: action.billId,
          amountSen: action.amountSen,
          sentLog: true,
        }),
      ];
      return { ...state, reminders, activity: [log, ...state.activity] };
    }

    case 'updateRoom':
      return {
        ...state,
        rooms: state.rooms.map((room) =>
          room.id === action.roomId ? { ...room, ...action.patch } : room,
        ),
      };

    case 'updateWeights':
      return {
        ...state,
        members: state.members.map((member) =>
          member.id in action.weights ? { ...member, weight: action.weights[member.id] } : member,
        ),
        bills: state.bills.map((bill) =>
          bill.method === 'weight' ? { ...bill, weights: { ...bill.weights, ...action.weights } } : bill,
        ),
      };

    case 'renounce':
      return {
        ...state,
        members: state.members.map((member) =>
          member.id === action.memberId ? { ...member, leftAt: NOW_ISO.slice(0, 10) } : member,
        ),
        subscription: {
          ...state.subscription,
          memberIds: state.subscription.memberIds.filter((id) => id !== action.memberId),
        },
      };

    case 'createHouse': {
      // A new house starts with no history: bills, tickets and reminders all
      // belong to the previous house and would otherwise show up as strangers
      // in the new one. The landlord is kept out of the billable member list,
      // so it is filtered out of the House Pass here too.
      const billable = action.members.filter((member) => member.role !== 'landlord');
      const owner = action.members.find((member) => member.id === action.ownerId);
      const log = activity(state, {
        actor: action.ownerId,
        kind: 'house',
        summary: `${owner?.firstName ?? '—'} set up ${action.house.name} for ${memberCount(billable.length)}`,
        detail: `${action.rooms.length}:${billable.length}`,
      });
      return {
        ...state,
        house: action.house,
        rooms: action.rooms,
        members: action.members,
        currentMemberId: action.ownerId,
        bills: [],
        tickets: [],
        reminders: [],
        activity: [log],
        subscription: {
          ...state.subscription,
          memberIds: billable.map((member) => member.id),
        },
        forceEmpty: false,
      };
    }

    case 'joinHouse': {
      if (state.members.some((member) => member.id === action.member.id)) return state;
      const log = activity(state, {
        actor: action.member.id,
        kind: 'house',
        summary: `${action.member.firstName} joined the house`,        detail: 'joined',
      });
      return {
        ...state,
        members: [...state.members, action.member],
        subscription: {
          ...state.subscription,
          memberIds: state.subscription.memberIds.includes(action.member.id)
            ? state.subscription.memberIds
            : [...state.subscription.memberIds, action.member.id],
        },
        activity: [log, ...state.activity],
      };
    }

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* persistence                                                         */
/* ------------------------------------------------------------------ */

function loadState(): AppState {
  const seed = createSeedState();
  if (typeof window === 'undefined') return seed;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== SEED_VERSION || !Array.isArray(parsed.bills)) return seed;
    return { ...parsed, storageError: false };
  } catch {
    // A corrupt or unreadable store falls back to the seed rather than to a
    // blank screen, and the copy tells the visitor nothing was lost.
    return { ...seed, storageError: true };
  }
}

function saveState(state: AppState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode or a full quota: the demo still works, it just forgets */
  }
}

/* ------------------------------------------------------------------ */
/* context                                                             */
/* ------------------------------------------------------------------ */

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  t: (key: Key, vars?: Record<string, string | number>) => string;
  lang: Lang;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createSeedState);
  const hydrated = useRef(false);

  useEffect(() => {
    dispatch({ type: 'hydrate', state: loadState() });
    hydrated.current = true;
  }, []);

  useEffect(() => {
    // The first save is held back until the stored state has been read, so a
    // returning visitor never gets their own house overwritten by the seed.
    if (hydrated.current && state.bootstrapped) saveState(state);
  }, [state]);

  const t = useMemo(() => translator(state.lang), [state.lang]);

  const value = useMemo<StoreValue>(
    () => ({ state, dispatch, t, lang: state.lang }),
    [state, t],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside <StoreProvider>');
  return value;
}

export function useT(): StoreValue['t'] {
  return useStore().t;
}

/** Small helper for the many one-shot actions screens dispatch. */
export function useActions() {
  const { dispatch } = useStore();
  return useMemo(
    () => ({
      setLang: (lang: Lang) => dispatch({ type: 'setLang', lang }),
      setRole: (role: DemoRole) => dispatch({ type: 'setRole', role }),
      toggleEmpty: () => dispatch({ type: 'toggleEmpty' }),
      reset: () => dispatch({ type: 'reset' }),
      addBill: (bill: Bill, memberIds: string[]) => dispatch({ type: 'addBill', bill, memberIds }),
      recordPayment: (billId: string, payment: Payment, billTitle: string) =>
        dispatch({ type: 'recordPayment', billId, payment, billTitle }),
      setBillMethod: (billId: string, method: Bill['method'], weights?: Record<string, number>) =>
        dispatch({ type: 'setBillMethod', billId, method, weights }),
      voidBill: (billId: string) => dispatch({ type: 'voidBill', billId }),
      deleteDraft: (billId: string) => dispatch({ type: 'deleteDraft', billId }),
      addTicket: (ticket: Ticket) => dispatch({ type: 'addTicket', ticket }),
      setTicketStatus: (ticketId: string, status: TicketStatus) =>
        dispatch({ type: 'setTicketStatus', ticketId, status }),
      readReminder: (reminderId: string) => dispatch({ type: 'readReminder', reminderId }),
      readAllReminders: () => dispatch({ type: 'readAllReminders' }),
      logReminderSent: (memberId: string, billId: string, amountSen: number) =>
        dispatch({ type: 'logReminderSent', memberId, billId, amountSen }),
      updateRoom: (roomId: string, patch: Partial<Room>) => dispatch({ type: 'updateRoom', roomId, patch }),
      updateWeights: (weights: Record<string, number>) => dispatch({ type: 'updateWeights', weights }),
      createHouse: (house: House, rooms: Room[], members: Member[], ownerId: string) =>
        dispatch({ type: 'createHouse', house, rooms, members, ownerId }),
      joinHouse: (member: Member) => dispatch({ type: 'joinHouse', member }),
    }),
    [dispatch],
  );
}
