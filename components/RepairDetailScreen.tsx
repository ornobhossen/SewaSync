'use client';

import { Check, Hammer, Wrench } from 'lucide-react';
import { useActions, useStore } from '@/lib/store';
import { roomById, visibleTickets } from '@/lib/selectors';
import { formatDate, formatRelative, localize } from '@/lib/dates';
import { getRepairImage } from '@/lib/images';
import type { Key, TFn } from '@/lib/i18n';
import { Button, Card, EmptyState, Notice, Pill, PhotoStub, Stack } from './ui';
import { MathNote } from './common';
import { PageHeader } from './Shell';
import { useToast } from './Toast';

const STATUS_TONE = {
  reported: 'overdue',
  acknowledged: 'partial',
  in_progress: 'soon',
  resolved: 'paid',
} as const;

function statusPill(status: keyof typeof STATUS_TONE, t: TFn) {
  return <Pill tone={STATUS_TONE[status]}>{t(`rep.${status}` as Key)}</Pill>;
}

export function RepairDetailScreen({ ticketId }: { ticketId: string }) {
  const { state, t, lang } = useStore();
  const { setTicketStatus } = useActions();
  const toast = useToast();

  // `visibleTickets` is the landlord-filtered list; a member sees their own
  // house, so the raw list is only consulted to tell "not yours" from "gone".
  const ticket =
    visibleTickets(state).find((item) => item.id === ticketId) ??
    state.tickets.find((item) => item.id === ticketId);

  if (!ticket) {
    return (
      <>
        <PageHeader title={t('rep.title')} backHref="/repairs/" />
        <div className="ss-pad od-stack pt-3" style={{ ['--od-gap' as string]: '14px' }}>
          <EmptyState
            icon={<Wrench size={20} />}
            title={t('rep.emptyTitle')}
            body={t('rep.emptyBody')}
            action={<Button href="/repairs/">{t('common.back')}</Button>}
          />
        </div>
      </>
    );
  }

  const room = roomById(state, ticket.roomId);
  const reporter = state.members.find((member) => member.id === ticket.reportedBy);
  const mine = ticket.reportedBy === state.currentMemberId;

  return (
    <>
      <PageHeader
        title={localize(ticket.title, lang)}
        kicker={t('rep.activity')}
        backHref="/repairs/"
      />

      <div className="ss-pad od-stack pt-3" style={{ ['--od-gap' as string]: '14px' }}>
        <Card className="px-3 py-3">
          <div className="od-stack" style={{ ['--od-gap' as string]: '10px' }}>
            <PhotoStub label={ticket.photo} ratio="4 / 3" src={getRepairImage(ticket.category)} />
            <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
              <span className="od-fill text-body font-semibold text-ink">
                {localize(ticket.title, lang)}
              </span>
              {statusPill(ticket.status, t)}
            </div>
            <p className="text-micro text-ink-muted">
              {t(`rep.cat.${ticket.category}` as Key)} · {room?.name ?? '—'}
            </p>
            <p className="text-micro text-ink-muted">
              {t('rep.reportedOn', {
                date: formatDate(ticket.reportedAt, lang, 'long'),
                name: reporter?.firstName ?? '—',
              })}
            </p>
            <p className="text-body text-ink">{localize(ticket.description, lang)}</p>
          </div>
        </Card>

        <div>
          <p className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {t('rep.activity')}
          </p>
        </div>

        <ul className="overflow-hidden rounded-card border border-line bg-white">
          {ticket.activity.map((entry) => {
            const actor = state.members.find((member) => member.id === entry.by);
            return (
              <li
                key={entry.id}
                className="od-row-top border-b border-line px-3 py-[10px] last:border-b-0"
                style={{ ['--od-gap' as string]: '8px' }}
              >
                <span className="mt-[6px] h-2 w-2 flex-none rounded-full bg-primary" />
                <span className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
                  <span className="text-body text-ink">
                    {t(`rep.${entry.to}` as Key)} · {actor?.firstName ?? '—'}
                  </span>
                  <span className="text-micro text-ink-muted">
                    {formatRelative(entry.at, lang)}
                    {entry.note ? ` · ${localize(entry.note, lang)}` : ''}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        <p className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
          {t('rep.changeStatus')}
        </p>

        {!mine && ticket.status === 'reported' ? (
          <Button
            full
            variant="secondary"
            icon={<Check size={18} />}
            onClick={() => {
              setTicketStatus(ticket.id, 'acknowledged');
              toast(t('rep.acknowledged'));
            }}
          >
            {t('rep.acknowledge')}
          </Button>
        ) : null}

        {ticket.status === 'acknowledged' ? (
          <Button
            full
            variant="secondary"
            icon={<Hammer size={18} />}
            onClick={() => {
              setTicketStatus(ticket.id, 'in_progress');
              toast(t('rep.in_progress'));
            }}
          >
            {t('rep.startWork')}
          </Button>
        ) : null}

        <Notice tone="neutral" title={t('rep.landlordNote')} body={t('rep.cannotResolve')} />
        {mine ? <MathNote>{t('rep.yourReport')}</MathNote> : null}
        <div className="pb-2" />
      </div>
    </>
  );
}
