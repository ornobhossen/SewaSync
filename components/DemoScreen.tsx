'use client';

import { ChevronRight, RotateCcw, Sparkles, Zap } from 'lucide-react';
import { useActions, useStore } from '@/lib/store';
import { currentMember, houseTotals, totalKwh } from '@/lib/selectors';
import { formatDate } from '@/lib/dates';
import { percent, ringgit } from '@/lib/money';
import { useRelHref } from '@/lib/routes';
import { Button, Card, Notice, Pill, Segmented, Stack } from './ui';
import { MathNote } from './common';
import { PageHeader } from './Shell';
import { useToast } from './Toast';

const JUMPS = [
  { href: '/', key: 'demo.jump.home' },
  { href: '/bills/view/?id=b-tnb', key: 'demo.jump.maths' },
  { href: '/bills/new/', key: 'demo.jump.add' },
  { href: '/bills/view/?id=b-rent', key: 'demo.jump.overdue' },
  { href: '/repairs/', key: 'demo.jump.repairs' },
  { href: '/landlord/', key: 'demo.jump.landlord' },
] as const;

export function DemoScreen() {
  const rel = useRelHref();
  const { state, t, lang } = useStore();
  const { setRole, toggleEmpty, reset } = useActions();
  const toast = useToast();
  const totals = houseTotals(state);
  const me = currentMember(state);

  return (
    <>
      <PageHeader title={t('demo.title')} kicker={state.house.name} />
      <div className="ss-pad od-stack pt-3" style={{ ['--od-gap' as string]: '14px' }}>
        <Notice tone="brand" title={t('demo.lead')} />

        <Card className="px-3 py-3">
          <div className="od-stack" style={{ ['--od-gap' as string]: '8px' }}>
            <p className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
              {t('demo.role')}
            </p>
            <Segmented<'member' | 'landlord'>
              value={state.demoRole}
              onChange={(value) => {
                setRole(value);
                if (value === 'landlord') toast(t('demo.jump.landlord'));
              }}
              options={[
                { value: 'member', label: t('demo.member') },
                { value: 'landlord', label: t('demo.landlord') },
              ]}
            />
            {state.demoRole === 'landlord' ? (
              <Button variant="secondary" full href="/landlord/">
                {t('house.preview')}
              </Button>
            ) : null}
          </div>
        </Card>

        <Stack gap={10}>
          <h2 className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {t('demo.jump')}
          </h2>
          <Card className="divide-y divide-line">
            {JUMPS.map((jump) => (
              <a
                key={jump.href}
                href={rel(jump.href)}
                className="ss-focus-ring od-row ss-row-press px-3 py-3"
                style={{ ['--od-gap' as string]: '10px' }}
              >
                <span className="od-fill text-body font-semibold text-ink">{t(jump.key)}</span>
                <ChevronRight size={16} className="flex-none text-ink-muted" />
              </a>
            ))}
          </Card>
        </Stack>

        <Card className="px-3 py-3">
          <div className="od-stack" style={{ ['--od-gap' as string]: '10px' }}>
            <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-btn bg-primary-soft text-primary-dark">
                <Sparkles size={18} />
              </span>
              <span className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
                <span className="text-body font-semibold text-ink">{t('acc.demo')}</span>
                <span className="text-body text-ink-muted">
                  {state.forceEmpty ? t('demo.emptyOn') : t('demo.emptyOff')}
                </span>
              </span>
              <Pill tone={state.forceEmpty ? 'overdue' : 'paid'}>
                {state.forceEmpty ? t('status.draft') : t('status.paid')}
              </Pill>
            </div>
            <Button
              variant="secondary"
              full
              icon={<Zap size={16} />}
              onClick={() => {
                toggleEmpty();
                toast(state.forceEmpty ? t('demo.emptyOff') : t('demo.emptyOn'));
              }}
            >
              {t('demo.empty')}
            </Button>
            <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
              <span className="od-fill text-body text-ink-muted">
                {t('bills.summary', {
                  n: totals.billCount,
                  amount: ringgit(totals.billed),
                  pct: percent(totals.paid, totals.billed, 0),
                })}
              </span>
            </div>
            <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
              <span className="od-fill text-body text-ink-muted">{t('deriv.totalUsage')}</span>
              <span className="tnum text-body font-semibold text-ink">{totalKwh(state)} kWh</span>
            </div>
            <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
              <span className="od-fill text-body text-ink-muted">{t('home.subscription')}</span>
              <span className="text-body font-semibold text-ink">
                {t('home.subRenew', { date: formatDate(state.subscription.renewalAt, lang) })}
              </span>
            </div>
          </div>
        </Card>

        <Button
          variant="danger"
          full
          icon={<RotateCcw size={16} />}
          onClick={() => {
            reset();
            toast(t('demo.resetDone'));
          }}
        >
          {t('demo.reset')}
        </Button>

        <MathNote>
          {t('demo.resetBody')} · {me.name}
        </MathNote>
        <div className="pb-2" />
      </div>
    </>
  );
}
