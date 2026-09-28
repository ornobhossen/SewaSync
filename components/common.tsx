'use client';

import { AlertTriangle, ChevronRight, Info, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Key, TFn } from '@/lib/i18n';
import { formatDate, formatPeriod, localize } from '@/lib/dates';
import { percent, ringgit } from '@/lib/money';
import { getAvatarSrc } from '@/lib/images';
import { useRelHref } from '@/lib/routes';
import type { AllocationWarning, Bill, DerivationRow, Lang, Member, Room } from '@/lib/types';
import type { AttentionItem, BillRow } from '@/lib/selectors';
import { paidForBill } from '@/lib/selectors';
import { Amount, Avatar, Card, Pill, Pressable, Progress, toneForBill, toneForPay } from './ui';


/* ------------------------------------------------------------------ */
/* status pills                                                        */
/* ------------------------------------------------------------------ */

/** The pill for a bill as a whole. */
export function BillStatusPill({ row, t }: { row: BillRow; t: TFn }) {
  if (row.billState === 'draft') return <Pill tone="draft">{t('status.draft')}</Pill>;
  if (row.billState === 'void') return <Pill tone="draft">{t('status.open')}</Pill>;
  if (row.billState === 'paid') return <Pill tone="paid">{t('status.paid')}</Pill>;
  if (row.billState === 'overdue') {
    return <Pill tone="overdue">{t('status.overdue', { d: row.billDaysOverdue })}</Pill>;
  }
  if (row.billState === 'part_paid') return <Pill tone="partial">{t('status.partPaid')}</Pill>;
  if (row.billState === 'due_soon') {
    return (
      <Pill tone="soon">
        {t('status.dueIn', { d: Math.max(0, row.daysUntilDue) })}
      </Pill>
    );
  }
  return <Pill tone="neutral">{t('status.unpaid')}</Pill>;
}

/** The pill for one person's share of a bill. */
export function ShareStatusPill({ row, t }: { row: BillRow; t: TFn }) {
  if (row.payState === 'paid') return <Pill tone="paid">{t('status.paid')}</Pill>;
  if (row.daysOverdue > 0) return <Pill tone="overdue">{t('status.overdue', { d: row.daysOverdue })}</Pill>;
  if (row.payState === 'partial') return <Pill tone="partial">{t('status.partPaid')}</Pill>;
  if (row.daysUntilDue <= 3) {
    return <Pill tone="soon">{t('status.dueIn', { d: Math.max(0, row.daysUntilDue) })}</Pill>;
  }
  return <Pill tone="neutral">{t('status.unpaid')}</Pill>;
}

export function PayStatePill({ state, t }: { state: 'paid' | 'partial' | 'unpaid'; t: TFn }) {
  if (state === 'paid') return <Pill tone="paid">{t('status.paid')}</Pill>;
  if (state === 'partial') return <Pill tone="partial">{t('status.partPaid')}</Pill>;
  return <Pill tone="neutral">{t('status.unpaid')}</Pill>;
}

export function MethodPill({ bill, t }: { bill: Bill; t: TFn }) {
  const key =
    bill.method === 'submeter'
      ? 'method.submeterShort'
      : bill.method === 'weight'
        ? 'method.weightShort'
        : bill.method === 'fixed'
          ? 'method.fixedShort'
          : 'method.equalShort';
  return (
    <span className="inline-flex items-center gap-1 text-micro font-semibold uppercase tracking-[0.06em] text-ink-muted">
      {bill.method === 'submeter' ? <Zap size={12} className="text-primary" /> : null}
      {t(key)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* bill card                                                           */
/* ------------------------------------------------------------------ */

export function BillCard({
  row,
  t,
  lang,
  showMine = true,
}: {
  row: BillRow;
  t: TFn;
  lang: Lang;
  showMine?: boolean;
}) {
  const { bill } = row;
  const mine = showMine ? ringgit(row.outstandingSen) : null;
  const houseRatio = bill.amountSen === 0 ? 1 : paidForBill(bill) / bill.amountSen;
  return (
    <Pressable href={`/bills/view/?id=${bill.id}`}>
      <Card className="px-3 py-3">
        <div className="od-row" style={{ ['--od-gap' as string]: '10px' }}>
          <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '3px' }}>
            <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
              <span className="od-fill od-truncate text-body font-semibold text-ink">
                {localize(bill.title, lang)}
              </span>
              <BillStatusPill row={row} t={t} />
            </div>
            <div className="od-row od-cluster" style={{ ['--od-gap' as string]: '8px' }}>
              <MethodPill bill={bill} t={t} />
              <span className="text-micro text-ink-muted">
                {formatPeriod(bill.period, lang)} · {ringgit(bill.amountSen)}
              </span>
            </div>
            {showMine ? (
              <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
                <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
                  <span className="text-micro font-semibold uppercase tracking-[0.06em] text-ink-muted">
                    {t('bills.yourShare', { amount: ringgit(row.shareSen) })}
                  </span>
                  <span className="text-body text-ink">
                    {row.payState === 'paid'
                      ? t('status.settled')
                      : row.payState === 'partial'
                        ? t('bill.partialOf', {
                            paid: ringgit(row.paidSen),
                            total: ringgit(row.shareSen),
                          })
                        : t('status.dueOn', { date: formatDate(bill.dueAt, lang) })}
                  </span>
                </div>
                <Amount value={mine ?? ''} size="body" />
              </div>
            ) : null}
            <Progress ratio={houseRatio} />
          </div>
          <ChevronRight size={18} className="flex-none text-ink-muted" />
        </div>
      </Card>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* attention rows                                                      */
/* ------------------------------------------------------------------ */

export function AttentionCard({
  items,
  t,
  lang,
  title,
  footer,
}: {
  items: AttentionItem[];
  t: TFn;
  lang: Lang;
  title: string;
  footer?: ReactNode;
}) {
  const rel = useRelHref();
  return (
    <Card className="px-3 py-3">
      <div className="od-stack" style={{ ['--od-gap' as string]: '10px' }}>
        <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
          <h2 className="od-fill text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {title}
          </h2>
          <Pill tone={items.some((item) => item.daysOverdue > 0) ? 'overdue' : 'partial'}>
            {items.length}
          </Pill>
        </div>
        <ul className="od-stack" style={{ ['--od-gap' as string]: '10px' }}>
          {items.map((item) => (
            <li key={item.key}>
              <a
                href={rel(`/bills/view/?id=${item.bill.id}`)}
                className="ss-focus-ring od-row ss-row-press rounded-btn"
                style={{ ['--od-gap' as string]: '10px' }}
              >
                <Avatar
                  initials={item.memberInitials || item.memberName.slice(0, 2).toUpperCase()}
                  size={32}
                  src={getAvatarSrc(item.memberInitials)}
                />
                <span className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
                  <span className="od-row" style={{ ['--od-gap' as string]: '6px' }}>
                    <span className="od-fill od-truncate text-body font-semibold text-ink">
                      {item.memberName}
                    </span>
                    {item.daysOverdue > 0 ? (
                      <Pill tone="overdue">{t('status.overdue', { d: item.daysOverdue })}</Pill>
                    ) : (
                      <Pill tone="partial">
                        {t('status.dueIn', { d: Math.max(0, item.daysUntilDue) })}
                      </Pill>
                    )}
                  </span>
                  <span className="od-truncate text-body text-ink-muted">
                    {item.isLandlordRent ? t('cat.rent') : localize(item.bill.title, lang)} ·{' '}
                    {ringgit(item.outstandingSen)}
                  </span>                </span>
                <ChevronRight size={16} className="flex-none text-ink-muted" />
              </a>
            </li>
          ))}
        </ul>
        {footer}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* people                                                              */
/* ------------------------------------------------------------------ */

export function MemberLine({
  member,
  room,
  trailing,
  href,
  sub,
}: {
  member: Member;
  room?: Room;
  trailing?: ReactNode;
  href?: string;
  sub?: string;
}) {
  const rel = useRelHref();
  const body = (
    <div className="od-row" style={{ ['--od-gap' as string]: '10px' }}>
      <Avatar initials={member.initials} src={getAvatarSrc(member.initials)} />
      <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
        <span className="od-truncate text-body font-semibold text-ink">{member.name}</span>
        <span className="od-truncate text-micro text-ink-muted">
          {room?.name ?? '—'}
          {sub ? <span> · {sub}</span> : null}
        </span>
      </div>
      {trailing}
    </div>
  );
  if (href) {
    return (
      <a href={rel(href)} className="ss-focus-ring ss-row-press block rounded-btn">
        {body}
      </a>
    );
  }
  return body;
}

/* ------------------------------------------------------------------ */
/* the maths                                                           */
/* ------------------------------------------------------------------ */

export function DerivationBlock({
  rows,
  title,
  person,
}: {
  rows: DerivationRow[];
  title?: string;
  person?: string;
}) {
  return (
    <div className="od-stack" style={{ ['--od-gap' as string]: '8px' }}>
      {title ? <p className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">{title}</p> : null}
      {person ? <p className="text-body text-ink-muted">{person}</p> : null}
      <ul
        className="overflow-hidden rounded-card border border-line bg-white"
        aria-label={title}
      >
        {rows.map((row, index) => (
          <li
            key={`${row.kind}-${index}`}
            className={`flex items-center gap-3 px-3 py-[10px] ${
              index === 0 ? '' : 'border-t border-line'
            } ${row.emphasis ? 'bg-[#F0FDFA]' : ''}`}
          >
            <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
              <span
                className={`text-body ${row.emphasis ? 'font-bold text-ink' : 'font-medium text-ink'}`}
              >
                {row.label}
              </span>
              {row.expr ? (
                <span className="tnum text-micro text-ink-muted">{row.expr}</span>
              ) : null}
            </div>
            <span
              className={`tnum od-nowrap text-body font-semibold ${
                row.emphasis ? 'text-primary-dark' : 'text-ink'
              }`}
            >
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WarningList({ warnings, t }: { warnings: AllocationWarning[]; t: TFn }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="od-stack" style={{ ['--od-gap' as string]: '8px' }}>
      {warnings.map((warning, index) => (
        <li
          key={`${warning.code}-${index}`}
          className="od-row-top rounded-card border border-[#FBD9A5] bg-[#FFFBEB] px-3 py-2"
          style={{ ['--od-gap' as string]: '8px' }}
        >
          <AlertTriangle size={16} className="mt-[2px] flex-none text-accent" />
          <p className="text-body text-ink">{t(warning.code as Key, warning.vars)}</p>
        </li>
      ))}
    </ul>
  );
}

export function MathNote({ children }: { children: ReactNode }) {
  return (
    <p className="od-row-top text-body text-ink-muted" style={{ ['--od-gap' as string]: '8px' }}>
      <Info size={15} className="mt-[2px] flex-none text-primary" />
      <span>{children}</span>
    </p>
  );
}

export function sharePercentRow(label: string, kwh: number, totalKwh: number) {
  return { label, expr: `${kwh} ÷ ${totalKwh}`, value: percent(kwh, totalKwh) };
}

export { toneForBill, toneForPay };
