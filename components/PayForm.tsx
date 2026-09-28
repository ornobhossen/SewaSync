'use client';

import { useState } from 'react';
import { Banknote, Check, ShieldCheck } from 'lucide-react';
import { useActions, useStore } from '@/lib/store';
import { membersInScope, rowFor } from '@/lib/selectors';
import { parseAmountToSen, ringgit } from '@/lib/money';
import { NOW_ISO } from '@/lib/dates';
import { useRelHref } from '@/lib/routes';
import type { Payment } from '@/lib/types';
import { Amount, Button, Card, EmptyState, Field, Notice, Pill, Segmented, Select, Stack, TextInput } from './ui';
import { MathNote, ShareStatusPill } from './common';
import { PageHeader } from './Shell';
import { useToast } from './Toast';

const METHODS = [
  { value: 'duitnow', key: 'pay.method.duitnow' },
  { value: 'bank', key: 'pay.method.bank' },
  { value: 'cash', key: 'pay.method.cash' },
  { value: 'household_fund', key: 'pay.method.household_fund' },
] as const;

type MethodId = Payment['method'];

export function PayForm({
  billId,
  memberId,
  onDone,
}: {
  billId: string;
  memberId?: string;
  onDone?: () => void;
}) {
  const { state, t, lang } = useStore();
  const { recordPayment } = useActions();
  const rel = useRelHref();
  const toast = useToast();

  const bill = state.bills.find((item) => item.id === billId);
  const [who, setWho] = useState(memberId ?? state.currentMemberId);
  const [method, setMethod] = useState<MethodId>('duitnow');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!bill) {
    // No id yet is the normal state of `/bills/pay/` before the query is read,
    // including in the static export. Only a bad id is an actual error.
    const badId = billId !== '';
    return (
      <EmptyState
        title={badId ? t('state.errorTitle') : t('bills.pickTitle')}
        body={badId ? t('state.errorBody') : t('bills.pickBody')}
        action={<Button href="/bills/">{t('bills.title')}</Button>}
      />
    );
  }

  const scope = membersInScope(state, bill.period);
  const row = rowFor(state, bill, who, t);
  const outstanding = row.outstandingSen;
  const entered = parseAmountToSen(amount);
  const partial = entered !== null && entered > 0 && entered < outstanding;

  const submit = () => {
    if (outstanding <= 0) return;
    const sen = entered === null || entered === 0 ? outstanding : entered;
    if (sen > outstanding) {
      setError(t('pay.errAmount'));
      return;
    }
    setError(null);
    recordPayment(
      bill.id,
      {
        id: `p-${bill.id}-${who}-${Date.now().toString(36)}`,
        memberId: who,
        amountSen: sen,
        paidAt: NOW_ISO,
        method,
        recordedBy: state.currentMemberId,
      },
      bill.title[lang],
    );
    toast(t('pay.recorded', { amount: ringgit(sen), bill: bill.title[lang] }));
    if (onDone) onDone();
    else window.location.assign(rel(`/bills/view/?id=${bill.id}`));
  };

  return (
    <Stack gap={14}>
      <Notice tone="brand" icon={<ShieldCheck size={16} />} title={t('pay.lead')} />

      <Card className="px-3 py-3">
        <div className="od-stack" style={{ ['--od-gap' as string]: '6px' }}>
          <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
            <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
              <span className="text-micro font-semibold uppercase tracking-[0.06em] text-ink-muted">
                {t('pay.bill')}
              </span>
              <span className="od-truncate text-body font-semibold text-ink">{bill.title[lang]}</span>
            </div>
            <ShareStatusPill row={row} t={t} />
          </div>
          <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
            <span className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
              <span className="text-micro text-ink-muted">{t('pay.shareOf', { amount: ringgit(row.shareSen) })}</span>
              <span className="text-body font-semibold text-ink">
                {t('pay.remaining', { amount: ringgit(outstanding) })}
              </span>
            </span>
            <Amount value={ringgit(outstanding)} size="page" />
          </div>
        </div>
      </Card>

      <Field label={t('pay.who')}>
        <Select value={who} onChange={(event) => setWho(event.target.value)}>
          {scope.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name}
              {member.id === state.currentMemberId ? ` (${t('setup.you')})` : ''}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t('pay.amount')} error={error ?? undefined} hint={t('pay.shareOf', { amount: ringgit(outstanding) })}>
        <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
          <TextInput
            inputMode="decimal"
            placeholder={ringgit(outstanding).replace('RM ', '')}
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setError(null);
            }}
          />
          <Button variant="secondary" onClick={() => setAmount(ringgit(outstanding).replace('RM ', ''))}>
            {t('bill.markAllPaid')}
          </Button>
        </div>
      </Field>

      <Field label={t('pay.method')}>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((item) => {
            const active = method === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setMethod(item.value)}
                className={`ss-focus-ring od-row rounded-btn border px-3 py-2 text-body font-semibold ${
                  active ? 'border-primary bg-primary-soft text-primary-dark' : 'border-line bg-white text-ink'
                }`}
                style={{ ['--od-gap' as string]: '8px' }}
              >
                <span className="od-fill od-truncate">{t(item.key)}</span>
                {active ? <Check size={15} className="flex-none" /> : null}
              </button>
            );
          })}
        </div>
      </Field>

      {partial ? <Notice tone="amber" title={t('pay.partialHint')} /> : null}
      {partial ? <Pill tone="partial">{t('status.partPaid')}</Pill> : null}

      <Button full disabled={outstanding <= 0} onClick={submit} icon={<Banknote size={18} />}>
        {t('pay.done')}
      </Button>
      <MathNote>{t('bill.noCustody')}</MathNote>
    </Stack>
  );
}

export function PayScreen({ billId, memberId }: { billId: string; memberId?: string }) {
  const { t } = useStore();
  return (
    <>
      <PageHeader title={t('pay.title')} backHref={billId ? `/bills/view/?id=${billId}` : '/bills/'} />
      <div className="ss-pad pt-4">
        <PayForm billId={billId} memberId={memberId} />
        <div className="pb-2" />
      </div>
    </>
  );
}
