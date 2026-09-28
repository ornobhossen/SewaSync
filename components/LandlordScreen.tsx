'use client';

import { useState } from 'react';
import { ArrowLeft, Check, EyeOff, Lock, Printer, Wrench } from 'lucide-react';
import { useActions, useStore } from '@/lib/store';
import { landlord, landlordView } from '@/lib/selectors';
import { formatDate, formatRelative, localize } from '@/lib/dates';
import { percent, ringgit } from '@/lib/money';
import type { Ticket } from '@/lib/types';
import { Amount, Button, Card, EmptyState, Notice, Pill, Progress, Segmented, Stack } from './ui';
import { MathNote, PayStatePill } from './common';
import { PageHeader } from './Shell';
import { useToast } from './Toast';

type Tab = 'overview' | 'tenants' | 'repairs';

export function LandlordScreen() {
  const { state, t, lang } = useStore();
  const { setTicketStatus } = useActions();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const view = landlordView(state, t);
  const owner = landlord(state);
  const collectedRatio = view.rentBilled === 0 ? 1 : view.rentCollected / view.rentBilled;

  return (
    <>
      <div className="border-b border-[#FBD9A5] bg-[#FFFBEB] px-4 py-2">
        <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
          <Lock size={14} className="flex-none text-[#B45309]" />
          <span className="text-micro font-bold uppercase tracking-[0.08em] text-[#92400E]">
            {t('ll.banner')}
          </span>
          <span className="od-fill" />
          <Button
            variant="ghost"
            href="/"
            icon={<ArrowLeft size={14} />}
            className="px-0"
          >
            {t('ll.back')}
          </Button>
        </div>
      </div>
      <PageHeader
        title={owner?.name ?? t('setup.landlord')}
        kicker={state.house.name}
      />
      <div className="ss-pad od-stack pt-3" style={{ ['--od-gap' as string]: '14px' }}>
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'overview', label: t('ll.tab.overview') },
            { value: 'tenants', label: t('ll.tab.tenants') },
            { value: 'repairs', label: t('ll.tab.repairs') },
          ]}
        />

        {tab === 'overview' ? (
          <>
            <Card className="px-3 py-3">
              <div className="od-stack" style={{ ['--od-gap' as string]: '8px' }}>
                <p className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  {t('ll.collected')}
                </p>
                <Amount value={ringgit(view.rentCollected)} size="hero" tone="ink" />
                <Progress ratio={collectedRatio} tone={collectedRatio >= 1 ? 'brand' : 'amber'} />
                <p className="text-body text-ink-muted">
                  {t('ll.of', { amount: ringgit(view.rentBilled) })} ·{' '}
                  {percent(view.rentCollected, view.rentBilled, 0)}
                </p>
                <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
                  <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
                    <span className="text-micro text-ink-muted">{t('ll.outstanding')}</span>
                    <Amount value={ringgit(view.rentOutstanding)} size="page" tone={view.rentOutstanding > 0 ? 'danger' : 'ink'} />
                  </div>
                  <p className="od-fixed max-w-[45%] text-right text-body text-ink-muted">
                    {view.outstandingTenantCount === 1
                      ? t('ll.across', { n: view.outstandingTenantCount })
                      : t('ll.acrossMany', { n: view.outstandingTenantCount })}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="px-3 py-3">
              <div className="od-stack" style={{ ['--od-gap' as string]: '8px' }}>
                <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-btn bg-[#EEF2F6] text-ink-muted">
                    <EyeOff size={17} />
                  </span>
                  <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
                    <span className="text-body font-semibold text-ink">{t('ll.utilityTitle')}</span>
                    <span className="text-body text-ink-muted">{t('ll.utilityBody')}</span>
                  </div>
                </div>
                <p className="tnum text-page font-bold text-ink">
                  {t('ll.utilityValue', { amount: ringgit(view.utilityTotalSen) })}
                </p>
                <MathNote>{t('ll.utilityHidden')}</MathNote>
              </div>
            </Card>

            <Button
              variant="secondary"
              full
              icon={<Printer size={16} />}
              onClick={() => {
                if (typeof window !== 'undefined') window.print();
              }}
            >
              {t('ll.export')}
            </Button>

            <Notice tone="neutral" title={t('ll.free')} body={t('ll.readOnlyNote')} />
          </>
        ) : null}

        {tab === 'tenants' ? (
          view.rentBills.length === 0 ? (
            <EmptyState title={t('ll.noRent')} body={t('bills.emptyBody')} />
          ) : (
            <Stack gap={10}>
              <MathNote>{t('ll.rentStatusOnly')}</MathNote>
              {view.tenants.map((tenant) => (
                <Card key={tenant.member.id} className="px-3 py-3">
                  <div className="od-row" style={{ ['--od-gap' as string]: '10px' }}>
                    <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '3px' }}>
                      <span className="text-body font-semibold text-ink">{tenant.member.name}</span>
                      <span className="text-micro text-ink-muted">
                        {tenant.room?.name ?? '—'} · {t('ll.tenure', { date: formatDate(tenant.member.joinedAt, lang) })}
                      </span>
                      <span className="tnum text-micro text-ink-muted">
                        {t('ll.printShare')}: {ringgit(tenant.shareSen)}
                      </span>
                    </div>
                    <div className="od-stack od-fixed items-end" style={{ ['--od-gap' as string]: '3px' }}>
                      <Amount
                        value={ringgit(tenant.outstandingSen)}
                        size="body"
                        tone={tenant.outstandingSen > 0 ? 'danger' : 'ink'}
                      />
                      <PayStatePill state={tenant.state} t={t} />
                    </div>
                  </div>
                </Card>
              ))}
            </Stack>
          )
        ) : null}

        {tab === 'repairs' ? (
          view.openRepairs.length === 0 ? (
            <EmptyState
              icon={<Wrench size={20} />}
              title={t('rep.emptyTitle')}
              body={t('rep.emptyBody')}
            />
          ) : (
            <Stack gap={10}>
              <MathNote>{t('ll.readOnlyNote')}</MathNote>
              {view.openRepairs.map((ticket) => (
                <LandlordTicket
                  key={ticket.id}
                  ticket={ticket}
                  onChange={(status) => {
                    setTicketStatus(ticket.id, status);
                    toast(t(`rep.${status}` as const));
                  }}
                />
              ))}
            </Stack>
          )
        ) : null}

        <div className="pb-2" />
      </div>
    </>
  );
}

function LandlordTicket({
  ticket,
  onChange,
}: {
  ticket: Ticket;
  onChange: (status: Ticket['status']) => void;
}) {
  const { state, t, lang } = useStore();
  const reporter = state.members.find((member) => member.id === ticket.reportedBy);
  const room = state.rooms.find((item) => item.id === ticket.roomId);
  const next: Partial<Record<Ticket['status'], Ticket['status']>> = {
    reported: 'acknowledged',
    acknowledged: 'in_progress',
    in_progress: 'resolved',
  };
  const target = next[ticket.status];

  return (
    <Card className="px-3 py-3">
      <div className="od-stack" style={{ ['--od-gap' as string]: '8px' }}>
        <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
          <span className="od-fill od-clamp-2 text-body font-semibold text-ink">
            {localize(ticket.title, lang)}
          </span>
          <Pill tone={ticket.status === 'resolved' ? 'paid' : 'partial'}>
            {t(`rep.${ticket.status}` as const)}
          </Pill>
        </div>
        <p className="text-micro text-ink-muted">
          {t(`rep.cat.${ticket.category}` as const)} · {room?.name ?? '—'} ·{' '}
          {t('rep.reportedOn', { date: formatDate(ticket.reportedAt, lang, 'long'), name: reporter?.firstName ?? '—' })}
        </p>
        <p className="text-body text-ink-muted">{localize(ticket.description, lang)}</p>
        <p className="text-micro text-ink-muted">{formatRelative(ticket.reportedAt, lang)}</p>
        {target ? (
          <Button full icon={<Check size={16} />} onClick={() => onChange(target)}>
            {target === 'acknowledged'
              ? t('rep.acknowledge')
              : target === 'in_progress'
                ? t('rep.startWork')
                : t('rep.markResolved')}
          </Button>
        ) : (
          <Pill tone="paid">{t('rep.resolved')}</Pill>
        )}
      </div>
    </Card>
  );
}
