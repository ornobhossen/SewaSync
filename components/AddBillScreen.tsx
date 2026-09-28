'use client';

import { useMemo, useRef, useState } from 'react';
import { Camera, Check, ChevronLeft, FileText, Info, Send } from 'lucide-react';
import { useActions, useStore } from '@/lib/store';
import { allocateBill, membersInScope } from '@/lib/selectors';
import { formatDate, formatPeriod, NOW_ISO } from '@/lib/dates';
import { parseAmountToSen, ringgit } from '@/lib/money';
import { useRelHref } from '@/lib/routes';
import type { Bill, BillCategory, SplitMethod } from '@/lib/types';
import { Amount, Button, Card, Field, Notice, PhotoStub, Pill, Segmented, Select, Stack, TextArea, TextInput } from './ui';
import { MathNote, MethodPill } from './common';
import { PageHeader } from './Shell';
import { useToast } from './Toast';

const CATEGORIES: BillCategory[] = ['electricity', 'water', 'wifi', 'rent', 'groceries', 'other'];
const METHODS: SplitMethod[] = ['submeter', 'weight', 'equal', 'fixed'];

const METHOD_LABEL: Record<SplitMethod, 'method.submeter' | 'method.weight' | 'method.equal' | 'method.fixed'> = {
  submeter: 'method.submeter',
  weight: 'method.weight',
  equal: 'method.equal',
  fixed: 'method.fixed',
};

export function AddBillScreen() {
  const { state, t, lang } = useStore();
  const { addBill } = useActions();
  const rel = useRelHref();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [category, setCategory] = useState<BillCategory>('electricity');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState('2026-09');
  const [payee, setPayee] = useState('');
  const [issuedAt, setIssuedAt] = useState('2026-09-15');
  const [dueAt, setDueAt] = useState('2026-09-30');
  const [receipt, setReceipt] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<SplitMethod>(state.house.defaultMethod);
  const [weights, setWeights] = useState<Record<string, number>>(() =>
    Object.fromEntries(state.members.filter((m) => m.role !== 'landlord').map((m) => [m.id, m.weight])),
  );
  const [fixed, setFixed] = useState<Record<string, string>>({});
  const [send, setSend] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const scope = membersInScope(state, period);
  const amountSen = parseAmountToSen(amount) ?? 0;

  const draft: Bill = useMemo(
    () => ({
      id: 'draft-preview',
      category,
      title: { en: title || 'New bill', bm: title || 'Bil baharu' },
      payee: { en: payee || '—', bm: payee || '—' },
      period,
      amountSen,
      issuedAt,
      dueAt,
      method,
      weights,
      fixedByRoomSen: Object.fromEntries(
        state.rooms
          .filter((room) => !room.isCommon)
          .map((room) => [room.id, parseAmountToSen(fixed[room.id] ?? '') ?? 0]),
      ),
      payments: [],
      sentToMembers: send,
      createdBy: state.currentMemberId,
      createdAt: NOW_ISO,
      receiptPhoto: receipt ?? undefined,
    }),
    [category, title, payee, period, amountSen, issuedAt, dueAt, method, weights, fixed, send, receipt, state],
  );

  const preview = useMemo(
    () => (amountSen > 0 ? allocateBill(state, draft, t) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, draft],
  );

  const validateStep1 = () => {
    const next: Record<string, string> = {};
    if (!parseAmountToSen(amount)) next.amount = t('add.errAmount');
    if (!payee.trim()) next.payee = t('add.errPayee');
    if (!dueAt) next.due = t('add.errDue');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateStep2 = () => {
    if (method === 'fixed') {
      const rooms = state.rooms.filter((room) => !room.isCommon);
      const missing = rooms.some((room) => !parseAmountToSen(fixed[room.id] ?? ''));
      if (missing) {
        setErrors({ fixed: t('add.errFixed') });
        return false;
      }
    }
    setErrors({});
    return true;
  };

  const submit = () => {
    const id = `b-${Date.now().toString(36)}`;
    const bill: Bill = {
      ...draft,
      id,
      title: {
        en: title || defaultTitle(category, period, lang),
        bm: title || defaultTitle(category, period, 'bm'),
      },
      note: note ? { en: note, bm: note } : undefined,
    };
    addBill(bill, scope.map((member) => member.id));
    toast(send ? t('add.sent', { n: scope.length }) : t('add.draftSaved'));
    window.location.assign(rel(send ? `/bills/view/?id=${id}` : '/bills/'));
  };

  const previewTitle = title || defaultTitle(category, period, lang);

  return (
    <>
      <PageHeader
        title={t('add.title')}
        backHref={step > 1 ? undefined : '/bills/'}
        kicker={t('common.step', { n: step })}
        action={
          step > 1 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)} icon={<ChevronLeft size={16} />}>
              {t('common.back')}
            </Button>
          ) : undefined
        }
      />

      <div className="ss-pad od-stack pt-3" style={{ ['--od-gap' as string]: '14px' }}>
        {step === 1 ? (
          <>
            <Field label={t('add.whatKind')}>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((item) => {
                  const active = category === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCategory(item)}
                      className={`ss-focus-ring od-touch rounded-btn border px-2 py-2 text-body font-semibold ${
                        active ? 'border-primary bg-primary-soft text-primary-dark' : 'border-line bg-white text-ink'
                      }`}
                    >
                      <span className="od-truncate">{t(`cat.${item}` as const)}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label={t('add.amount')} error={errors.amount}>
              <TextInput
                inputMode="decimal"
                placeholder={t('add.amountPlaceholder')}
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setErrors({});
                }}
              />
            </Field>

            <Field label={t('rep.titleField')} hint={t('common.optional')}>
              <TextInput value={title} onChange={(event) => setTitle(event.target.value)} />
            </Field>

            <Field label={t('add.period')}>
              <TextInput type="month" value={period} onChange={(event) => setPeriod(event.target.value)} />
            </Field>

            <Field label={t('add.payee')} error={errors.payee}>
              <TextInput
                value={payee}
                placeholder={t('add.payeePlaceholder')}
                onChange={(event) => {
                  setPayee(event.target.value);
                  setErrors({});
                }}
              />
            </Field>

            <div className="grid grid-cols-2 gap-2">
              <Field label={t('add.issued')}>
                <TextInput type="date" value={issuedAt} onChange={(event) => setIssuedAt(event.target.value)} />
              </Field>
              <Field label={t('add.due')} error={errors.due}>
                <TextInput
                  type="date"
                  value={dueAt}
                  onChange={(event) => {
                    setDueAt(event.target.value);
                    setErrors({});
                  }}
                />
              </Field>
            </div>

            <Field label={t('add.receipt')} hint={t('add.receiptSkipped')}>
              {receipt ? <PhotoStub label={receipt} ratio="16 / 9" /> : null}
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => setReceipt(event.target.files?.[0]?.name ?? null)}
              />
              <Button
                variant="secondary"
                icon={<Camera size={16} />}
                onClick={() => fileInput.current?.click()}
              >
                {receipt ? t('add.receiptAttached') : t('add.choosePhoto')}
              </Button>
            </Field>

            <Button
              full
              disabled={!parseAmountToSen(amount)}
              onClick={() => {
                if (validateStep1()) setStep(2);
              }}
            >
              {t('common.next')}
            </Button>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Field label={t('add.howToSplit')}>
              <div className="od-stack" style={{ ['--od-gap' as string]: '8px' }}>
                {METHODS.map((item) => {
                  const active = method === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setMethod(item)}
                      className={`ss-focus-ring od-row rounded-card border px-3 py-2 text-left ${
                        active ? 'border-primary bg-[#F0FDFA]' : 'border-line bg-white'
                      }`}
                      style={{ ['--od-gap' as string]: '10px' }}
                    >
                      <span className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
                        <span className="text-body font-semibold text-ink">{t(METHOD_LABEL[item])}</span>
                        <span className="text-micro text-ink-muted">
                          {item === 'submeter'
                            ? t('method.whySubmeter')
                            : item === 'weight'
                              ? t('method.whyWeight')
                              : item === 'fixed'
                                ? t('method.whyFixed')
                                : t('method.whyEqual')}
                        </span>
                      </span>
                      {active ? <Check size={16} className="flex-none text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
            </Field>

            {method === 'weight' ? (
              <Field label={t('add.weights')} hint={t('add.weightsHelp')}>
                <div className="od-stack" style={{ ['--od-gap' as string]: '8px' }}>
                  {scope.map((member) => (
                    <div key={member.id} className="od-row" style={{ ['--od-gap' as string]: '10px' }}>
                      <span className="od-fill od-truncate text-body font-medium text-ink">{member.name}</span>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setWeights({ ...weights, [member.id]: Math.max(1, (weights[member.id] ?? 1) - 1) })
                        }
                      >
                        −
                      </Button>
                      <span className="tnum w-6 text-center text-body font-bold">{weights[member.id] ?? 1}</span>
                      <Button
                        variant="secondary"
                        onClick={() => setWeights({ ...weights, [member.id]: (weights[member.id] ?? 1) + 1 })}
                      >
                        +
                      </Button>
                    </div>
                  ))}
                </div>
              </Field>
            ) : null}

            {method === 'fixed' ? (
              <Field label={t('add.fixedPerRoom')} hint={t('add.fixedHelp')} error={errors.fixed}>
                <div className="od-stack" style={{ ['--od-gap' as string]: '8px' }}>
                  {state.rooms
                    .filter((room) => !room.isCommon)
                    .map((room) => (
                      <div key={room.id} className="od-row" style={{ ['--od-gap' as string]: '10px' }}>
                        <span className="od-fill od-truncate text-body font-medium text-ink">{room.name}</span>
                        <TextInput
                          inputMode="decimal"
                          className="w-28"
                          value={fixed[room.id] ?? ''}
                          onChange={(event) => setFixed({ ...fixed, [room.id]: event.target.value })}
                        />
                      </div>
                    ))}
                </div>
              </Field>
            ) : null}

            {method === 'submeter' ? (
              <Card className="px-3 py-3">
                <p className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  {t('deriv.totalUsage')}
                </p>
                <ul className="od-stack mt-1" style={{ ['--od-gap' as string]: '6px' }}>
                  {state.rooms.map((room) => (
                    <li key={room.id} className="od-row text-body" style={{ ['--od-gap' as string]: '8px' }}>
                      <span className="od-fill od-truncate text-ink">{room.name}</span>
                      <span className="tnum text-ink-muted">
                        {room.meter
                          ? `${room.meter.prevKwh} → ${room.meter.currKwh} (${Math.max(
                              0,
                              room.meter.currKwh - room.meter.prevKwh,
                            )} kWh)`
                          : t('house.noMeter')}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <Segmented
              value={send ? 'on' : 'off'}
              onChange={(value) => setSend(value === 'on')}
              options={[
                { value: 'on', label: t('add.sendTo', { n: scope.length }) },
                { value: 'off', label: t('status.draft') },
              ]}
            />
            <Notice tone="neutral" title={send ? t('add.sent', { n: scope.length }) : t('add.sendOff')} body={t('method.whyBody')} />

            <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
              <Button variant="secondary" onClick={() => setStep(1)} icon={<ChevronLeft size={16} />}>
                {t('common.back')}
              </Button>
              <Button
                full
                onClick={() => {
                  if (validateStep2()) setStep(3);
                }}
              >
                {t('common.next')}
              </Button>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <Card className="px-3 py-3">
              <div className="od-stack" style={{ ['--od-gap' as string]: '6px' }}>
                <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
                  <span className="od-fill od-truncate text-page font-bold text-ink">{previewTitle}</span>
                  <Amount value={ringgit(amountSen)} size="body" />
                </div>
                <div className="od-cluster" style={{ ['--od-gap' as string]: '8px' }}>
                  <MethodPill bill={draft} t={t} />
                  <Pill tone="brand">{formatPeriod(period, lang)}</Pill>
                </div>
                <p className="text-body text-ink-muted">
                  {t('bill.payableTo', { payee: payee || '—' })} · {t('status.dueOn', { date: formatDate(dueAt, lang) })}
                </p>
              </div>
            </Card>

            <Field label={t('add.preview')}>
              <ul className="od-stack overflow-hidden rounded-card border border-line bg-white" style={{ ['--od-gap' as string]: '0px' }}>
                {scope.map((member) => {
                  const allocation = preview?.perMember[member.id];
                  return (
                    <li
                      key={member.id}
                      className="od-row border-b border-line px-3 py-2 last:border-b-0"
                      style={{ ['--od-gap' as string]: '8px' }}
                    >
                      <span className="od-fill od-truncate text-body font-medium text-ink">{member.name}</span>
                      {method === 'submeter' && allocation ? (
                        <span className="tnum text-micro text-ink-muted">{allocation.kwh} kWh</span>
                      ) : null}
                      <span className="tnum text-body font-semibold text-ink">
                        {ringgit(allocation?.amountSen ?? 0)}
                      </span>
                    </li>
                  );
                })}
                <li className="od-row bg-[#F8FAFC] px-3 py-2" style={{ ['--od-gap' as string]: '8px' }}>
                  <span className="od-fill text-body font-semibold text-ink">{t('deriv.shareOfBill')}</span>
                  <span className="tnum text-body font-bold text-primary-dark">{ringgit(amountSen)}</span>
                </li>
              </ul>
            </Field>

            <Notice
              tone="brand"
              title={t('add.previewNote')}
              body={t('rem.templateOverdue', {
                name: 'Kavintharan',
                bill: previewTitle,
                amount: ringgit(preview?.perMember['m-kavin']?.amountSen ?? 0),
                period: formatPeriod(period, lang),
              })}
            />

            <Field label={t('add.note')} hint={t('common.optional')}>
              <TextArea value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>

            {preview && preview.fallbackToEqual ? (
              <Notice tone="amber" title={t('warn.no_usage_equal_fallback')} />
            ) : null}
            {preview && preview.warnings.length > 0 ? (
              <MathNote>{t(preview.warnings[0].code as never, preview.warnings[0].vars)}</MathNote>
            ) : null}

            <Stack gap={10}>
              <Button full icon={<Send size={18} />} onClick={submit} disabled={amountSen <= 0}>
                {send ? t('add.send') : t('common.save')}
              </Button>
              <Button variant="secondary" full icon={<ChevronLeft size={16} />} onClick={() => setStep(2)}>
                {t('common.back')}
              </Button>
            </Stack>

            <MathNote>
              <span className="inline-flex items-center gap-1">
                <Info size={14} className="flex-none" />
                {t('bill.noCustody')}
              </span>
            </MathNote>
            <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
              <FileText size={15} className="flex-none text-ink-muted" />
              <span className="text-micro text-ink-muted">{t('rem.composerNote')}</span>
            </div>
          </>
        ) : null}

        <div className="pb-2" />
      </div>
    </>
  );
}

function defaultTitle(category: BillCategory, period: string, lang: 'en' | 'bm'): string {
  const label: Record<BillCategory, string> = {
    electricity: 'Electricity',
    water: 'Water',
    wifi: 'Wi-Fi',
    rent: 'Rent',
    internet: 'Internet',
    groceries: 'Groceries',
    other: 'Other',
  };
  return `${label[category]} · ${formatPeriod(period, lang)}`;
}
