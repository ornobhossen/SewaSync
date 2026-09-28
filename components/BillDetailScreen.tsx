'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  Check,
  ChevronDown,
  ChevronRight,
  BellRing,
  Ban,
} from 'lucide-react';
import { useActions, useStore } from '@/lib/store';
import { allocateBill, membersInScope, paidFor, roomFor, rowFor } from '@/lib/selectors';
import { formatDate, formatPeriod, localize } from '@/lib/dates';
import type { TFn } from '@/lib/i18n';
import { ringgit, sumSen } from '@/lib/money';
import { getAvatarSrc } from '@/lib/images';
import type { Bill, SplitMethod } from '@/lib/types';
import { Amount, Avatar, Button, Card, EmptyState, Notice, Pill, Segmented, Sheet, Stack } from './ui';
import {
  BillStatusPill,
  DerivationBlock,
  MathNote,
  MethodPill,
  PayStatePill,
  ShareStatusPill,
  WarningList,
} from './common';
import { PageHeader } from './Shell';
import { useToast } from './Toast';

type Tab = 'breakdown' | 'paid';
type Compare = 'usage' | 'equal';

const METHOD_KEYS: { value: SplitMethod; key: 'method.submeter' | 'method.weight' | 'method.equal' | 'method.fixed' }[] = [
  { value: 'submeter', key: 'method.submeter' },
  { value: 'weight', key: 'method.weight' },
  { value: 'equal', key: 'method.equal' },
  { value: 'fixed', key: 'method.fixed' },
];

/**
 * Why a method produces the shares it does.
 *
 * This copy used to be written out inline in three places, and one of them
 * had the sub-meter wording hardcoded, so a fixed-amount rent bill explained
 * itself with sub-meters. One definition, so a bill can never be described
 * by a method it is not using.
 */
function methodWhy(method: SplitMethod, t: TFn): string {
  return method === 'submeter'
    ? t('method.whySubmeter')
    : method === 'weight'
      ? t('method.whyWeight')
      : method === 'fixed'
        ? t('method.whyFixed')
        : t('method.whyEqual');
}

export function BillDetailScreen({ billId }: { billId: string }) {
  const { state, t, lang } = useStore();
  const { setBillMethod, logReminderSent, voidBill, deleteDraft } = useActions();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('breakdown');
  const [compare, setCompare] = useState<Compare>('usage');
  const [openMember, setOpenMember] = useState<string | null>(null);
  const [methodOpen, setMethodOpen] = useState(false);

  const bill = state.bills.find((item) => item.id === billId);

  const result = useMemo(
    () => (bill ? allocateBill(state, bill, t) : null),
    [bill, state.members, state.rooms, state.lang],
  );

  if (!bill || !result) {
    // No id yet is the normal state of `/bills/view/` before the query is read,
    // including in the static export. Only a bad id is an actual error.
    const badId = billId !== '';
    return (
      <>
        <PageHeader title={t('bills.title')} backHref="/bills/" />
        <div className="ss-pad pt-4">
          <EmptyState
            icon={badId ? <AlertTriangle size={20} /> : undefined}
            title={badId ? t('state.errorTitle') : t('bills.pickTitle')}
            body={badId ? t('state.errorBody') : t('bills.pickBody')}
            action={<Button href="/bills/">{t('bills.title')}</Button>}
          />
        </div>
      </>
    );
  }

  const scope = membersInScope(state, bill.period);
  const myRow = result.perMember[state.currentMemberId];
  const myShare = myRow?.amountSen ?? 0;
  const myPaid = paidFor(bill, state.currentMemberId);
  const myOutstanding = Math.max(0, myShare - myPaid);
  const equalShare = result.equal[state.currentMemberId] ?? 0;
  const delta = myShare - equalShare;
  const rounded = scope.filter((member) => (result.perMember[member.id]?.roundingSen ?? 0) !== 0);
  const payee = localize(bill.payee, lang);

  return (
    <>
      <PageHeader
        title={localize(bill.title, lang)}
        backHref="/bills/"
        kicker={t(`cat.${bill.category}` as const)}
      />
      <div className="ss-pad od-stack pt-3" style={{ ['--od-gap' as string]: '14px' }}>
        <Card className="px-3 py-3">
          <div className="od-stack" style={{ ['--od-gap' as string]: '6px' }}>
            <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
              <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
                <span className="text-micro font-semibold uppercase tracking-[0.06em] text-ink-muted">
                  {formatPeriod(bill.period, lang)}
                </span>
                <Amount value={ringgit(bill.amountSen)} size="page" />
              </div>
              <BillStatusPill row={rowFor(state, bill, state.currentMemberId, t)} t={t} />
            </div>
            <p className="text-body text-ink-muted">
              {t('bill.payableTo', { payee })} · {t('status.dueOn', { date: formatDate(bill.dueAt, lang) })}
            </p>
            <div className="od-cluster" style={{ ['--od-gap' as string]: '8px' }}>
              <Pill tone={bill.method === 'submeter' ? 'brand' : 'neutral'}>
                {bill.method === 'submeter' ? t('method.fairest') : t('method.whyTitle')}
              </Pill>
              <MethodPill bill={bill} t={t} />
              {bill.method === 'submeter' ? (
                <span className="tnum text-micro text-ink-muted">
                  {t('bill.usageUsed', { kwh: result.totalKwh })}
                </span>
              ) : null}
            </div>
          </div>
        </Card>

        <WarningList warnings={result.warnings} t={t} />

        {/* my share */}
        <Card className="px-3 py-3">
          <div className="od-stack" style={{ ['--od-gap' as string]: '8px' }}>
            <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
              <p className="od-fill text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {t('bills.yourShare', { amount: ringgit(myShare) })}
              </p>
              <ShareStatusPill row={rowFor(state, bill, state.currentMemberId, t)} t={t} />
            </div>
            {myPaid > 0 && myPaid < myShare ? (
              <p className="text-body font-semibold text-[#B45309]">
                {t('bill.partialOf', { paid: ringgit(myPaid), total: ringgit(myShare) })}
              </p>
            ) : null}
            {delta !== 0 ? (
              <Notice
                tone="brand"
                icon={<ArrowLeftRight size={16} />}
                title={
                  delta > 0
                    ? t('bill.comparePrompt', { amount: ringgit(delta) })
                    : t('bill.comparePromptLess', { amount: ringgit(-delta) })
                }
                body={methodWhy(bill.method, t)}
              />
            ) : (
              <Notice tone="neutral" title={t('bill.compareSame')} body={t('method.whyEqual')} />
            )}
            <Button
              variant="secondary"
              full
              onClick={() => setCompare(compare === 'usage' ? 'equal' : 'usage')}
              icon={<ArrowLeftRight size={16} />}
            >
              {compare === 'usage' ? t('bill.compareReveal') : t('bill.compareBack')}
            </Button>
            <Segmented<Compare>
              value={compare}
              onChange={setCompare}
              options={[
                { value: 'usage', label: t('bill.compareActive') },
                { value: 'equal', label: t('bill.compareInactive') },
              ]}
            />
            <DerivationBlock
              rows={
                compare === 'usage'
                  ? (myRow?.derivation ?? [])
                  : [
                      {
                        kind: 'equal' as const,
                        label: t('deriv.equalAcross', { n: result.memberCount }),
                        expr: t('deriv.divided', { total: bill.amountSen, by: result.memberCount }),
                        value: ringgit(equalShare),
                      },
                      {
                        kind: 'charge' as const,
                        label: t('deriv.yourCharge'),
                        value: ringgit(equalShare),
                        emphasis: true,
                      },
                    ]
              }
            />
            {delta !== 0 ? (
              <p className="text-body font-semibold text-primary-dark">
                {delta > 0
                  ? t('bill.compareDelta', { amount: ringgit(delta) })
                  : t('bill.compareDeltaLess', { amount: ringgit(-delta) })}
              </p>
            ) : null}
            <MathNote>{t('method.whyBody')}</MathNote>
          </div>
        </Card>

        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'breakdown', label: t('bill.tabBreakdown') },
            { value: 'paid', label: t('bill.tabPaid') },
          ]}
        />

        {tab === 'breakdown' ? (
          <Stack gap={10}>
            <Card className="px-3 py-3">
              <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
                <p className="od-fill text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  {t('method.whyTitle')}
                </p>
                <Button variant="ghost" onClick={() => setMethodOpen(true)}>
                  {t('method.change')}
                </Button>
              </div>
              <p className="mt-1 text-body text-ink-muted">{methodWhy(bill.method, t)}</p>
              {result.fallbackToEqual ? (
                <p className="mt-2 text-body font-semibold text-[#B45309]">
                  {t('warn.no_usage_equal_fallback')}
                </p>
              ) : null}
            </Card>

            {scope.map((member) => {
              const allocation = result.perMember[member.id];
              if (!allocation) return null;
              const row = rowFor(state, bill, member.id, t);
              const open = openMember === member.id;
              const room = roomFor(state, member);
              return (
                <Card key={member.id} className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => setOpenMember(open ? null : member.id)}
                    className="ss-focus-ring od-row w-full text-left"
                    style={{ ['--od-gap' as string]: '10px' }}
                  >
                    <Avatar initials={member.initials} src={getAvatarSrc(member.initials)} />
                    <span className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
                      <span className="od-row" style={{ ['--od-gap' as string]: '6px' }}>
                        <span className="od-fill od-truncate text-body font-semibold text-ink">
                          {member.name}
                        </span>
                        <ShareStatusPill row={row} t={t} />
                      </span>
                      <span className="od-truncate text-micro text-ink-muted">
                        {room?.name ?? '—'}
                        {bill.method === 'submeter' ? ` · ${allocation.kwh} kWh` : ''}
                        {allocation.assumption ? ` · ${t('deriv.houseAverage')}` : ''}
                      </span>
                    </span>
                    <span className="od-stack od-fixed items-end" style={{ ['--od-gap' as string]: '2px' }}>
                      <Amount value={ringgit(allocation.amountSen)} size="body" />
                      {row.paidSen > 0 ? (
                        <span className="tnum text-micro text-ink-muted">
                          {t('bill.partialOf', { paid: ringgit(row.paidSen), total: ringgit(allocation.amountSen) })}
                        </span>
                      ) : null}
                    </span>
                    {open ? (
                      <ChevronDown size={16} className="flex-none text-ink-muted" />
                    ) : (
                      <ChevronRight size={16} className="flex-none text-ink-muted" />
                    )}
                  </button>
                  {open ? (
                    <div className="mt-3 od-stack" style={{ ['--od-gap' as string]: '10px' }}>
                      <DerivationBlock
                        rows={allocation.derivation}
                        person={t('deriv.forWhom', { name: member.name })}
                      />
                      {row.outstandingSen > 0 ? (
                        <Button
                          variant="secondary"
                          full
                          icon={<BellRing size={16} />}
                          onClick={() => {
                            logReminderSent(member.id, bill.id, row.outstandingSen);
                            toast(t('rem.sent', { name: member.firstName }));
                          }}
                        >
                          {t('bill.payFor')}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </Card>
              );
            })}

            <Card className="px-3 py-3">
              <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
                <p className="od-fill text-body font-semibold text-ink">
                  {t('deriv.shareOfBill')} · {t('deriv.totalUsage')}
                </p>
                <Amount value={ringgit(sumSen(Object.values(result.perMember).map((m) => m.amountSen)))} size="body" />
              </div>
              <p className="mt-1 text-micro text-ink-muted">
                {t('deriv.shareOfBill')} · {t('common.of')} {ringgit(bill.amountSen)} {t('common.of')} {payee}
              </p>
              {rounded.length > 0 ? (
                <p className="mt-2 text-body text-ink-muted">
                  {t('bill.roundingNote', {
                    amount: ringgit(result.roundingTotalSen),
                    plural: rounded.length > 1 ? t('bill.roundingNotePlural') : '',
                    payee,
                  })}
                </p>
              ) : null}
            </Card>
          </Stack>
        ) : (
          <Stack gap={10}>
            <Card className="px-3 py-3">
              <p className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {t('bill.paidSubTitle')}
              </p>
              {bill.payments.length === 0 ? (
                <p className="mt-1 text-body text-ink-muted">{t('house.noHistory')}</p>
              ) : (
                <ul className="od-stack mt-2" style={{ ['--od-gap' as string]: '10px' }}>
                  {bill.payments.map((payment) => {
                    const member = state.members.find((item) => item.id === payment.memberId);
                    return (
                      <li key={payment.id} className="od-row" style={{ ['--od-gap' as string]: '10px' }}>
                        <Avatar initials={member?.initials ?? '--'} size={30} src={member ? getAvatarSrc(member.initials) : undefined} />
                        <span className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
                          <span className="text-body font-semibold text-ink">{member?.name ?? '—'}</span>
                          <span className="text-micro text-ink-muted">
                            {formatDate(payment.paidAt, lang, 'long')} · {t(`pay.method.${payment.method}` as const)}
                          </span>
                        </span>
                        <Amount value={ringgit(payment.amountSen)} size="body" />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Stack gap={10}>
              {scope
                .filter((member) => rowFor(state, bill, member.id, t).outstandingSen > 0)
                .map((member) => {
                  const row = rowFor(state, bill, member.id, t);
                  return (
                    <Card key={member.id} className="px-3 py-3">
                      <div className="od-row" style={{ ['--od-gap' as string]: '10px' }}>
                        <Avatar initials={member.initials} size={30} src={getAvatarSrc(member.initials)} />
                        <span className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
                          <span className="text-body font-semibold text-ink">{member.name}</span>
                          <span className="tnum text-micro text-ink-muted">
                            {t('bill.partialOf', { paid: ringgit(row.paidSen), total: ringgit(row.shareSen) })}
                          </span>
                        </span>
                        <PayStatePill state={row.payState} t={t} />
                      </div>
                      <div className="mt-2 od-row" style={{ ['--od-gap' as string]: '8px' }}>
                        <Button
                          variant="secondary"
                          href={`/bills/pay/?id=${bill.id}&member=${member.id}`}
                          icon={<Banknote size={16} />}
                        >
                          {member.id === state.currentMemberId ? t('bill.record') : t('bill.markPaidFor', { name: member.firstName })}
                        </Button>
                      </div>
                    </Card>
                  );
                })}
            </Stack>
          </Stack>
        )}

        <Stack gap={10}>
          {myOutstanding > 0 && bill.sentToMembers ? (
            <Button
              full
              href={`/bills/pay/?id=${bill.id}`}
              icon={<Banknote size={18} />}
            >
              {t('bill.record')} · {ringgit(myOutstanding)}
            </Button>
          ) : null}
          {bill.sentToMembers && bill.payments.length > 0 ? (
            <Button
              variant="danger"
              full
              icon={<Ban size={16} />}
              onClick={() => {
                voidBill(bill.id);
                toast(t('bill.voided'));
              }}
            >
              {t('bill.void')}
            </Button>
          ) : null}
          {!bill.sentToMembers ? (
            <Button
              variant="danger"
              full
              icon={<Check size={16} />}
              onClick={() => {
                deleteDraft(bill.id);
                toast(t('common.done'));
              }}
            >
              {t('bill.delete')}
            </Button>
          ) : null}
          <MathNote>{t('bill.noCustody')}</MathNote>
        </Stack>

        <div className="pb-2" />
      </div>

      <Sheet open={methodOpen} onClose={() => setMethodOpen(false)} title={t('method.change')}>
        <Stack gap={10}>
          <p className="text-body text-ink-muted">{t('method.whyBody')}</p>
          {METHOD_KEYS.map((method) => (
            <button
              key={method.value}
              type="button"
              onClick={() => {
                setBillMethod(bill.id, method.value);
                setMethodOpen(false);
                toast(`${t('method.change')}: ${t(method.key)}`);
              }}
              className={`ss-focus-ring od-row rounded-btn border px-3 py-2 text-left ${
                bill.method === method.value
                  ? 'border-primary bg-primary-soft'
                  : 'border-line bg-white'
              }`}
              style={{ ['--od-gap' as string]: '10px' }}
            >
              <span className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
                <span className="text-body font-semibold text-ink">{t(method.key)}</span>
                <span className="text-micro text-ink-muted">{methodWhy(method.value, t)}</span>
              </span>
              {bill.method === method.value ? <Check size={16} className="flex-none text-primary" /> : null}
            </button>
          ))}
        </Stack>
      </Sheet>
    </>
  );
}
