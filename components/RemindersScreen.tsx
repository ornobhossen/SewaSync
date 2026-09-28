'use client';

import { useState } from 'react';
import { BellRing, CheckCheck, ShieldCheck } from 'lucide-react';
import { useActions, useStore } from '@/lib/store';
import { attentionItems, membersInScope, myReminders } from '@/lib/selectors';
import { formatDate, formatPeriod, formatRelative, localize } from '@/lib/dates';
import { ringgit } from '@/lib/money';
import { useRelHref } from '@/lib/routes';
import type { Reminder } from '@/lib/types';
import { Amount, Button, Card, EmptyState, Field, Notice, Pill, Select, Stack, TextArea } from './ui';
import { MathNote } from './common';
import { PageHeader } from './Shell';
import { useToast } from './Toast';

export function RemindersScreen() {
  const { state, t, lang } = useStore();
  const { readAllReminders, readReminder, logReminderSent } = useActions();
  const toast = useToast();
  const [who, setWho] = useState(state.currentMemberId);
  const [open, setOpen] = useState(false);

  const reminders = myReminders(state);
  const attention = attentionItems(state, t);
  const scope = membersInScope(state, '9999-12');

  const target = attention.find((item) => item.memberId === who) ?? attention[0];
  const member = state.members.find((item) => item.id === who);
  const template = target
    ? target.daysOverdue > 0
      ? t('rem.templateOverdue', {
          name: member?.firstName ?? '',
          bill: target.isLandlordRent ? t('cat.rent') : localize(target.bill.title, lang),
          amount: ringgit(target.outstandingSen),
          period: formatPeriod(target.bill.period, lang),
        })
      : t('rem.templateDueSoon', {
          name: member?.firstName ?? '',
          bill: localize(target.bill.title, lang),
          period: formatPeriod(target.bill.period, lang),
          days: Math.max(0, target.daysUntilDue),
          amount: ringgit(target.outstandingSen),
        })
    : '';

  return (
    <>
      <PageHeader
        title={t('rem.title')}
        kicker={state.house.name}
        action={
          <Button variant="ghost" onClick={() => { readAllReminders(); toast(t('rem.allRead')); }}>
            {t('rem.markAllRead')}
          </Button>
        }
      />
      <div className="ss-pad od-stack pt-3" style={{ ['--od-gap' as string]: '14px' }}>
        {reminders.length === 0 ? (
          <EmptyState
            icon={<BellRing size={20} />}
            title={t('rem.emptyTitle')}
            body={t('rem.emptyBody')}
            action={<Button href="/bills/">{t('bills.title')}</Button>}
          />
        ) : (
          <Stack gap={10}>
            {reminders.map((reminder) => (
              <ReminderRow
                key={reminder.id}
                reminder={reminder}
                onRead={() => readReminder(reminder.id)}
              />
            ))}
          </Stack>
        )}

        <Card className="px-3 py-3">
          <div className="od-stack" style={{ ['--od-gap' as string]: '10px' }}>
            <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
              <h2 className="od-fill text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {t('rem.composer')}
              </h2>
              <ShieldCheck size={16} className="text-primary" />
            </div>
            <p className="text-body text-ink-muted">{t('rem.composerBody')}</p>
            <Field label={t('pay.who')}>
              <Select value={who} onChange={(event) => setWho(event.target.value)}>
                {scope.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <TextArea readOnly value={template} className="text-body text-ink" />
            <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
              <Button
                full
                variant="secondary"
                icon={<BellRing size={16} />}
                disabled={!target}
                onClick={() => {
                  if (!target) return;
                  logReminderSent(target.memberId, target.bill.id, target.outstandingSen);
                  toast(t('rem.sent', { name: target.memberName }));
                  setOpen(true);
                }}
              >
                {t('rem.send')}
              </Button>
            </div>
            {open ? <Notice tone="brand" title={t('rem.sent', { name: member?.firstName ?? '' })} body={t('rem.sentBody')} /> : null}
            <MathNote>{t('rem.composerNote')}</MathNote>
          </div>
        </Card>

        <div className="pb-2" />
      </div>
    </>
  );
}

function ReminderRow({ reminder, onRead }: { reminder: Reminder; onRead: () => void }) {
  const { state, t, lang } = useStore();
  const rel = useRelHref();
  const bill = state.bills.find((item) => item.id === reminder.billId);
  const ticket = state.tickets.find((item) => item.id === reminder.ticketId);
  const payer = state.members.find((item) => item.id === reminder.memberId);

  const body = describe(reminder, state, t, lang, bill, ticket, payer?.firstName ?? '');

  const href = bill
    ? `/bills/view/?id=${bill.id}`
    : ticket
      ? '/repairs/'
      : reminder.kind === 'subscription'
        ? '/account/'
        : '/bills/';

  return (
    <PressableCard onClick={onRead}>
      <div className="od-row-top" style={{ ['--od-gap' as string]: '10px' }}>
        <span
          className={`mt-[6px] h-2.5 w-2.5 flex-none rounded-full ${
            reminder.read ? 'bg-[#CBD5E1]' : 'bg-danger'
          }`}
        />
        <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '3px' }}>
          <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
            <span className="od-fill od-truncate text-body font-semibold text-ink">
              {t(`rem.kind.${reminder.kind}` as const)}
            </span>
            {reminder.kind === 'overdue' ? <Pill tone="overdue">{t('status.overdue', { d: reminder.days ?? 0 })}</Pill> : null}
            {reminder.kind === 'due_soon' ? <Pill tone="partial">{t('status.dueIn', { d: reminder.days ?? 0 })}</Pill> : null}
          </div>
          <p className="text-body text-ink-muted">{body}</p>
          <p className="text-micro text-ink-muted">{formatRelative(reminder.at, lang)}</p>
          <div className="od-cluster mt-1" style={{ ['--od-gap' as string]: '6px' }}>
            <a
              href={rel(href)}
              onClick={(event) => event.stopPropagation()}
              className="ss-focus-ring od-touch inline-flex items-center gap-1 rounded-full border border-line bg-white px-2 py-[3px] text-micro font-semibold uppercase tracking-[0.06em] text-ink"
            >
              {reminder.kind === 'payment_recorded' || reminder.kind === 'maths' || reminder.kind === 'bill_sent'
                ? t('rem.viewBill')
                : reminder.kind === 'repair'
                  ? t('rem.openTicket')
                  : t('rem.viewBill')}
            </a>
            {reminder.amountSen ? (
              <span className="tnum inline-flex items-center gap-1 text-micro font-semibold text-ink">
                <Amount value={ringgit(reminder.amountSen)} size="body" />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </PressableCard>
  );
}

function PressableCard({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <Card className="px-3 py-3">
      <button type="button" onClick={onClick} className="ss-focus-ring block w-full text-left">
        {children}
      </button>
    </Card>
  );
}

function describe(
  reminder: Reminder,
  state: ReturnType<typeof useStore>['state'],
  t: ReturnType<typeof useStore>['t'],
  lang: 'en' | 'bm',
  bill: ReturnType<typeof useStore>['state']['bills'][number] | undefined,
  ticket: ReturnType<typeof useStore>['state']['tickets'][number] | undefined,
  payerName: string,
): string {
  switch (reminder.kind) {
    case 'overdue':
      return t('rem.body.overdue', {
        amount: ringgit(reminder.amountSen ?? 0),
        name: payerName,
        days: reminder.days ?? 0,
      });
    case 'due_soon':
      return t('rem.body.due_soon', {
        bill: bill ? localize(bill.title, lang) : '',
        days: reminder.days ?? 0,
        amount: ringgit(reminder.amountSen ?? 0),
      });
    case 'maths':
      return t('rem.body.maths', {
        bill: bill ? localize(bill.title, lang) : '',
        period: bill ? formatPeriod(bill.period, lang) : '',
        method: bill ? t(METHOD_KEY[bill.method]) : '',
      });
    case 'subscription':
      return t('rem.body.subscription', { date: formatDate(state.subscription.renewalAt, lang) });
    case 'sent':
      return t('rem.body.sent', { name: payerName, amount: ringgit(reminder.amountSen ?? 0) });
    case 'payment_recorded':
      return t('rem.body.payment_recorded', {
        name: payerName,
        amount: ringgit(reminder.amountSen ?? 0),
        bill: bill ? localize(bill.title, lang) : '',
      });
    case 'repair':
      return t('rem.body.repair', {
        title: ticket ? localize(ticket.title, lang) : '',
        status: ticket ? t(`rep.${ticket.status}`) : '',
      });
    case 'bill_sent':
    default:
      return t('rem.body.bill_sent', {
        title: bill ? localize(bill.title, lang) : '',
        n: state.members.filter((member) => member.role !== 'landlord').length,
      });
  }
}

const METHOD_KEY = {
  submeter: 'method.submeterShort',
  weight: 'method.weightShort',
  equal: 'method.equalShort',
  fixed: 'method.fixedShort',
} as const;
