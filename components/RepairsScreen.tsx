'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Wrench } from 'lucide-react';
import { useActions, useStore } from '@/lib/store';
import { openTickets, resolvedTickets, roomById, visibleTickets } from '@/lib/selectors';
import { formatDate, formatRelative, localize } from '@/lib/dates';
import { getRepairImage } from '@/lib/images';
import { useRelHref } from '@/lib/routes';
import type { Ticket } from '@/lib/types';
import { Button, Card, EmptyState, Pill, PhotoStub, Stack } from './ui';
import { MathNote } from './common';
import { PageHeader } from './Shell';
import { useToast } from './Toast';

const STATUS_TONE = {
  reported: 'overdue',
  acknowledged: 'partial',
  in_progress: 'soon',
  resolved: 'paid',
} as const;

export function RepairsScreen() {
  const { state, t, lang } = useStore();
  const { setTicketStatus } = useActions();
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);

  const tickets = visibleTickets(state);
  const openList = openTickets(state);
  const resolvedList = resolvedTickets(state);

  return (
    <>
      <PageHeader
        title={t('rep.title')}
        kicker={state.house.name}
        action={
          <Button href="/repairs/new/" icon={<Plus size={18} />}>
            {t('header.newRepair')}
          </Button>
        }
      />
      <div className="ss-pad od-stack pt-3" style={{ ['--od-gap' as string]: '14px' }}>
        {tickets.length === 0 ? (
          <EmptyState
            icon={<Wrench size={20} />}
            title={t('rep.emptyTitle')}
            body={t('rep.emptyBody')}
            action={<Button href="/repairs/new/">{t('rep.emptyAction')}</Button>}
          />
        ) : null}

        {openList.length > 0 ? (
          <Stack gap={10}>
            <h2 className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
              {t('home.openRepairsValue', { n: openList.length })}
            </h2>
            {openList.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                expanded={open === ticket.id}
                onToggle={() => setOpen(open === ticket.id ? null : ticket.id)}
                onAcknowledge={() => {
                  setTicketStatus(ticket.id, 'acknowledged');
                  toast(t('rep.acknowledged'));
                }}
                onStart={() => {
                  setTicketStatus(ticket.id, 'in_progress');
                  toast(t('rep.in_progress'));
                }}
              />
            ))}
          </Stack>
        ) : null}

        {resolvedList.length > 0 ? (
          <Stack gap={10}>
            <h2 className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
              {t('rep.resolvedGroup', { n: resolvedList.length })}
            </h2>
            {resolvedList.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                expanded={open === ticket.id}
                onToggle={() => setOpen(open === ticket.id ? null : ticket.id)}
              />
            ))}
          </Stack>
        ) : null}

        <Card className="px-3 py-3">
          <div className="od-stack" style={{ ['--od-gap' as string]: '6px' }}>
            <p className="text-body font-semibold text-ink">{t('rep.landlordNote')}</p>
            <MathNote>{t('rep.cannotResolve')}</MathNote>
            <Button variant="secondary" href="/landlord/" full>
              {t('house.preview')}
            </Button>
          </div>
        </Card>

        <div className="pb-2" />
      </div>
    </>
  );
}

function TicketCard({
  ticket,
  expanded,
  onToggle,
  onAcknowledge,
  onStart,
}: {
  ticket: Ticket;
  expanded: boolean;
  onToggle: () => void;
  onAcknowledge?: () => void;
  onStart?: () => void;
}) {
  const { state, t, lang } = useStore();
  const rel = useRelHref();
  const room = roomById(state, ticket.roomId);
  const reporter = state.members.find((member) => member.id === ticket.reportedBy);
  const mine = ticket.reportedBy === state.currentMemberId;

  return (
    <Card className="px-3 py-3">
      <div className="od-stack" style={{ ['--od-gap' as string]: '10px' }}>
        <div className="od-row" style={{ ['--od-gap' as string]: '10px' }}>
          <PhotoStub label={ticket.photo} ratio="1 / 1" className="w-20 flex-none" src={getRepairImage(ticket.category)} />
          <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '4px' }}>
            <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
              <a
                href={rel(`/repairs/${ticket.id}/`)}
                className="ss-focus-ring od-fill od-clamp-2 text-left text-body font-semibold text-ink"
              >
                {localize(ticket.title, lang)}
              </a>
              <Pill tone={STATUS_TONE[ticket.status]}>{t(`rep.${ticket.status}` as const)}</Pill>
            </div>
            <p className="text-micro text-ink-muted">
              {t(`rep.cat.${ticket.category}` as const)} · {room?.name ?? '—'}
            </p>
            <p className="text-micro text-ink-muted">
              {t('rep.reportedOn', { date: formatDate(ticket.reportedAt, lang, 'long'), name: reporter?.firstName ?? '—' })}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="ss-focus-ring od-row w-full text-left"
          style={{ ['--od-gap' as string]: '8px' }}
        >
          <span className="od-fill text-body font-semibold text-primary">{t('rep.activity')}</span>
          {expanded ? <ChevronDown size={16} className="text-ink-muted" /> : <ChevronRight size={16} className="text-ink-muted" />}
        </button>

        {expanded ? (
          <div className="od-stack" style={{ ['--od-gap' as string]: '10px' }}>
            <p className="text-body text-ink-muted">{localize(ticket.description, lang)}</p>
            <ul className="od-stack" style={{ ['--od-gap' as string]: '8px' }}>
              {ticket.activity.map((entry) => {
                const actor = state.members.find((member) => member.id === entry.by);
                return (
                  <li key={entry.id} className="od-row-top" style={{ ['--od-gap' as string]: '8px' }}>
                    <span className="mt-[2px] h-2 w-2 flex-none rounded-full bg-primary" />
                    <span className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
                      <span className="text-body text-ink">
                        {t(`rep.${entry.to}` as const)} · {actor?.firstName ?? '—'}
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
            {!mine && ticket.status === 'reported' && onAcknowledge ? (
              <Button variant="secondary" full onClick={onAcknowledge}>
                {t('rep.acknowledge')}
              </Button>
            ) : null}
            {ticket.status === 'acknowledged' && onStart ? (
              <Button variant="secondary" full onClick={onStart}>
                {t('rep.startWork')}
              </Button>
            ) : null}
            {mine ? <MathNote>{t('rep.yourReport')}</MathNote> : null}
            <a
              href={rel('/landlord/')}
              className="ss-focus-ring text-body font-semibold text-primary"
            >
              {t('house.landlordAccess')}
            </a>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
