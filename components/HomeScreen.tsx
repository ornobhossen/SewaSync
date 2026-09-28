'use client';

import { useState } from 'react';
import {
  Camera,
  ChevronRight,
  CircleDollarSign,
  FilePlus2,
  Home as HomeIcon,
  Receipt,
  Wrench,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { useRelHref } from '@/lib/routes';
import {
  attentionItems,
  currentMember,
  houseOverdue,
  memberTotals,
  openTickets,
  rowsFor,
  countedBills,
  houseTotals,
} from '@/lib/selectors';
import { formatDate, formatRelative, greetingKey, localize } from '@/lib/dates';
import { percent, ringgit } from '@/lib/money';
import { Amount, Card, Pill, Stack } from './ui';
import { AttentionCard, DerivationBlock, MathNote, ShareStatusPill } from './common';
import { HeaderActions } from './Shell';

/* ------------------------------------------------------------------ */

function Hero() {
  const { state, t, lang } = useStore();
  const rel = useRelHref();
  const me = currentMember(state);
  const totals = memberTotals(state, state.currentMemberId, t);
  const house = houseTotals(state);
  const behind = houseOverdue(state, t);
  const greeting = t(`home.${greetingKey()}` as const);
  // Whoever is furthest behind leads the line, so the link goes to that bill.
  const worst = behind.items[0];

  return (
    <section className="ss-hero px-4 pb-5 pt-3">
      <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
        <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '0px' }}>
          <span className="ss-hero-muted text-body">
            {greeting} {me.firstName}
          </span>
        </div>
        <div className="od-row" style={{ ['--od-gap' as string]: '6px' }}>
          <span className="ss-hero-muted text-micro">{t('app.tagline')}</span>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-micro font-semibold uppercase tracking-[0.1em] ss-hero-muted">
          {t('home.outstanding')}
        </p>
        <Amount
          value={ringgit(totals.outstanding)}
          size="hero"
          tone="inverse"
        />
        <p className="mt-1 text-body ss-hero-muted">{t('home.sentVia')}</p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {(
          [
            ['home.paid', totals.paid, 'text-[#A7F3D0]'],
            ['home.due', totals.due, 'text-[#FDE68A]'],
            ['home.overdue', totals.overdue, 'text-[#FECACA]'],
          ] as const
        ).map(([key, value, colour]) => (
          <div
            key={key}
            className="rounded-card border border-white/15 bg-white/10 px-2.5 py-2 backdrop-blur-[1px]"
          >
            <p className="text-micro font-semibold uppercase tracking-[0.06em] ss-hero-muted">
              {t(key)}
            </p>
            <p className={`tnum od-nowrap mt-[2px] text-body font-bold ${colour}`}>
              {ringgit(value)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
          <span className="text-micro ss-hero-muted">
            {t('bills.summary', {
              n: house.billCount,
              amount: ringgit(house.billed),
              pct: percent(house.paid, house.billed, 0),
            })}
          </span>
        </div>
        <span className="mt-1 block h-[5px] w-full overflow-hidden rounded-full bg-white/20">
          <span
            className="block h-full rounded-full bg-[#5EEAD4] transition-[width] duration-300"
            style={{ width: `${Math.min(100, house.settledPct)}%` }}
          />
        </span>
      </div>

      {worst ? (
        <a
          href={rel(`/bills/view/?id=${worst.bill.id}`)}
          className="ss-focus-ring mt-3 block rounded-btn border border-white/15 bg-white/10 px-2.5 py-2 backdrop-blur-[1px] ss-row-press"
        >
          <p className="text-micro font-semibold uppercase tracking-[0.06em] ss-hero-muted">
            {t('home.houseOverdue')}
          </p>
          <p className="tnum od-nowrap mt-[2px] text-body font-bold text-[#FECACA]">
            {ringgit(behind.totalSen)}
          </p>
          <p className="od-nowrap mt-[2px] text-micro ss-hero-muted">
            {behind.items.length === 1
              ? t('home.houseOverdueOne', {
                  name: worst.memberName,
                  d: worst.daysOverdue,
                  bill: localize(worst.bill.title, lang),
                })
              : t('home.houseOverdueMany', { n: behind.items.length, d: behind.worstDays })}
          </p>
        </a>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function WhyCard() {
  const { state, t } = useStore();
  const [open, setOpen] = useState(false);

  // The first bill this member still owes, soonest due first.
  const target = countedBills(state)
    .map((bill) => rowsFor(state, bill, t).find((row) => row.memberId === state.currentMemberId))
    .filter((row): row is NonNullable<typeof row> => Boolean(row && row.outstandingSen > 0))
    .sort((a, b) => a.bill.dueAt.localeCompare(b.bill.dueAt))[0];

  if (!target) return null;
  const derivation = target.result.perMember[state.currentMemberId]?.derivation ?? [];

  return (
    <Card className="px-3 py-3">
      <div className="od-stack" style={{ ['--od-gap' as string]: '8px' }}>
        <p className="text-body font-bold text-ink">
          {t('home.whyTitle', { amount: ringgit(target.outstandingSen) })}
        </p>
        <p className="text-body text-ink-muted">{t('home.whyBody')}</p>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="od-touch ss-focus-ring inline-flex items-center gap-1 self-start text-body font-semibold text-primary"
        >
          {open ? t('home.whyCollapse') : t('home.whyCta')}
          <ChevronRight
            size={16}
            className={open ? 'rotate-90 transition-transform' : 'transition-transform'}
          />
        </button>
        {open ? (
          <div className="od-stack" style={{ ['--od-gap' as string]: '10px' }}>
            <ShareStatusPill row={target} t={t} />
            <DerivationBlock
              rows={derivation}
              title={t('deriv.title')}
              person={t('deriv.forWhom', { name: currentMember(state).name })}
            />
            <MathNote>{t('method.whyBody')}</MathNote>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

const QUICK_ACTIONS = [
  { href: '/bills/new/', icon: FilePlus2, key: 'home.qa.addBill' },
  { href: '/snap/', icon: Camera, key: 'home.qa.snapMeter' },
  { href: '/bills/', icon: CircleDollarSign, key: 'home.qa.logPayment' },
  { href: '/repairs/new/', icon: Wrench, key: 'home.qa.reportRepair' },
] as const;

function QuickActions() {
  const { t } = useStore();
  const rel = useRelHref();
  return (
    <Stack gap={10}>
      <h2 className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
        {t('home.quickActions')}
      </h2>
      <div className="grid grid-cols-2 gap-2">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <a
              key={action.href}
              href={rel(action.href)}
              className="ss-focus-ring od-stack ss-row-press rounded-card border border-line bg-white px-3 py-3"
              style={{ ['--od-gap' as string]: '8px' }}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-btn bg-primary-soft text-primary-dark">
                <Icon size={18} />
              </span>
              <span className="text-body font-semibold text-ink">{t(action.key)}</span>
            </a>
          );
        })}
      </div>
    </Stack>
  );
}

/* ------------------------------------------------------------------ */

function PulseCard() {
  const { state, t, lang } = useStore();
  const rel = useRelHref();
  const open = openTickets(state);
  const sub = state.subscription;
  const nextRent = state.bills
    .filter((bill) => bill.category === 'rent')
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];

  return (
    <Card className="px-3 py-3">
      <div className="od-stack" style={{ ['--od-gap' as string]: '10px' }}>
        <h2 className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
          {t('home.pulse')}
        </h2>
        <a href={rel('/repairs/')} className="ss-focus-ring od-row ss-row-press rounded-btn" style={{ ['--od-gap' as string]: '10px' }}>
          <Wrench size={18} className="flex-none text-primary" />
          <span className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
            <span className="text-body font-semibold text-ink">{t('home.openRepairs')}</span>
            <span className="text-micro text-ink-muted">
              {open.length === 0 ? t('rep.emptyTitle') : t('home.openRepairsValue', { n: open.length })}
            </span>
          </span>
          <ChevronRight size={16} className="flex-none text-ink-muted" />
        </a>
        {nextRent ? (
          <a href={rel(`/bills/view/?id=${nextRent.id}`)} className="ss-focus-ring od-row ss-row-press rounded-btn" style={{ ['--od-gap' as string]: '10px' }}>
            <HomeIcon size={18} className="flex-none text-primary" />
            <span className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
              <span className="text-body font-semibold text-ink">{t('home.nextRent')}</span>
              <span className="text-micro text-ink-muted">
                {ringgit(nextRent.amountSen)} · {t('status.dueOn', { date: formatDate(nextRent.dueAt, lang) })}
              </span>
            </span>
            <ChevronRight size={16} className="flex-none text-ink-muted" />
          </a>
        ) : null}
        <a href={rel('/account/')} className="ss-focus-ring od-row ss-row-press rounded-btn" style={{ ['--od-gap' as string]: '10px' }}>
          <Receipt size={18} className="flex-none text-primary" />
          <span className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
            <span className="text-body font-semibold text-ink">{t('home.subscription')}</span>
            <span className="text-micro text-ink-muted">{t('home.subLine')}</span>
          </span>
          <Pill tone="brand">{t('home.subActive', { n: sub.memberIds.length, total: sub.memberIds.length })}</Pill>
        </a>
      </div>
    </Card>
  );
}



export function HomeScreen() {
  const { state, t, lang } = useStore();
  const rel = useRelHref();
  // Worst first across the whole house, not just the reader's own shares.
  // Showing only the current member's rows hid a housemate's overdue rent
  // from anyone who had settled their own share, which is exactly when a
  // member is most likely to assume the house is fine.
  const attention = attentionItems(state, t);

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2">
        <img src="/logo.png" alt="SewaSync" className="h-7 w-auto" />
        <div className="flex items-center gap-1.5">
          <HeaderActions />
        </div>
      </div>
      <Hero />
      <div className="ss-pad od-stack pt-4" style={{ ['--od-gap' as string]: '16px' }}>
        {attention.length > 0 ? (
          <AttentionCard
                  items={attention.slice(0, 3)}
                  t={t}
                  lang={lang}
            title={t('home.attention')}
            footer={
              <a
                href={rel('/bills/')}
                className="ss-focus-ring od-touch text-body font-semibold text-primary"
              >
                {t('bills.title')}
              </a>
            }
          />
        ) : null}

        <WhyCard />
        <PulseCard />
        <QuickActions />

        <MathNote>{t('bill.noCustody')}</MathNote>
        <div className="pb-2" />
      </div>
    </>
  );
}
