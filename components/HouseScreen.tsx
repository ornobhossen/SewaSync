'use client';

import { useState } from 'react';
import { Check, Gauge, MapPin, Pencil, Plug, UserPlus } from 'lucide-react';
import { useActions, useStore } from '@/lib/store';
import {
  activityFeed,
  currentMember,
  memberById,
  roomFor,
  statementFor,
  totalKwh,
  visibleTickets,
} from '@/lib/selectors';
import { formatDate, formatPeriod, formatRelative, localize } from '@/lib/dates';
import { getAvatarSrc } from '@/lib/images';
import { parseAmountToSen, ringgit, sumSen } from '@/lib/money';
import { useRelHref } from '@/lib/routes';
import type { Room } from '@/lib/types';
import {
  Amount,
  Avatar,
  Button,
  Card,
  EmptyState,
  Field,
  Notice,
  Pill,
  Sheet,
  Stack,
  TextInput,
} from './ui';
import { MathNote, MemberLine, PayStatePill } from './common';
import { PageHeader } from './Shell';
import { useToast } from './Toast';

export function HouseScreen() {
  const { state, t, lang } = useStore();
  const { updateRoom } = useActions();
  const rel = useRelHref();
  const toast = useToast();
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [statement, setStatement] = useState<string | null>(null);
  const [rent, setRent] = useState('');
  const [prev, setPrev] = useState('');
  const [curr, setCurr] = useState('');
  const [hasMeter, setHasMeter] = useState(true);
  const [showAllActivity, setShowAllActivity] = useState(false);

  const me = currentMember(state);
  const members = state.members.filter((member) => member.role !== 'landlord');
  const rooms = state.rooms.filter((room) => !room.isCommon);
  const common = state.rooms.find((room) => room.isCommon);
  const openRepairs = visibleTickets(state).filter((ticket) => ticket.status !== 'resolved');
  const statementMember = statement ? memberById(state, statement) : undefined;
  const lines = statement ? statementFor(state, statement, t) : [];
  const feed = activityFeed(state);
  const shownFeed = showAllActivity ? feed : feed.slice(0, 5);

  const openEditor = (room: Room) => {
    setEditRoom(room);
    setRent(room.rentSen === null ? '' : ringgit(room.rentSen).replace('RM ', ''));
    setPrev(room.meter ? String(room.meter.prevKwh) : '');
    setCurr(room.meter ? String(room.meter.currKwh) : '');
    setHasMeter(room.meter !== null);
  };

  const saveRoom = () => {
    if (!editRoom) return;
    const next = parseAmountToSen(rent);
    const prevKwh = Number(prev);
    const currKwh = Number(curr);
    updateRoom(editRoom.id, {
      rentSen: next,
      meter:
        hasMeter && Number.isFinite(prevKwh) && Number.isFinite(currKwh)
          ? { prevKwh, currKwh }
          : null,
    });
    setEditRoom(null);
    toast(t('common.done'));
  };

  return (
    <>
      <PageHeader
        title={t('house.title')}
        kicker={state.house.name}
        action={
          <Button
            variant="secondary"
            icon={<UserPlus size={16} />}
            onClick={() => {
              const link = `${typeof window === 'undefined' ? '' : window.location.origin}/setup/invite/?house=${state.house.id}`;
              void navigator.clipboard?.writeText(link);
              toast(t('house.linkCopied'));
            }}
          >
            {t('house.invite')}
          </Button>
        }
      />

      <div className="ss-pad od-stack pt-3" style={{ ['--od-gap' as string]: '14px' }}>
        <Card className="px-3 py-3">
          <div className="od-stack" style={{ ['--od-gap' as string]: '6px' }}>
            <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
              <h2 className="od-fill text-page font-bold text-ink">{state.house.name}</h2>
              <Pill tone="brand">
                {t('common.people').replace(/^\w/, (c) => c.toUpperCase())} {members.length}
              </Pill>
            </div>
            <p className="od-row text-body text-ink-muted" style={{ ['--od-gap' as string]: '6px' }}>
              <MapPin size={15} className="flex-none" />
              <span className="od-clamp-2">
                {state.house.address}, {state.house.city}
              </span>
            </p>
            <p className="od-row text-body text-ink-muted" style={{ ['--od-gap' as string]: '6px' }}>
              <Gauge size={15} className="flex-none" />
              <span className="tnum">{t('deriv.totalUsage')}: {totalKwh(state)} kWh</span>
            </p>
          </div>
        </Card>

        <Stack gap={10}>
          <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
            <h2 className="od-fill text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
              {t('house.rooms')}
            </h2>
          </div>
          <p className="-mt-1 text-body text-ink-muted">{t('house.roomsBody')}</p>
          {rooms.map((room) => {
            const pax = members.filter((member) => member.roomId === room.id);
            const delta = room.meter ? room.meter.currKwh - room.meter.prevKwh : null;
            return (
              <Card key={room.id} className="px-3 py-3">
                <div className="od-row" style={{ ['--od-gap' as string]: '10px' }}>
                  <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '3px' }}>
                    <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
                      <span className="od-fill text-body font-semibold text-ink">{room.name}</span>
                      <Pill tone="neutral">{t('house.occupancy', { n: pax.length })}</Pill>
                    </div>
                    <p className="tnum text-body text-ink-muted">
                      {t('house.perMonth', { amount: room.rentSen === null ? '—' : ringgit(room.rentSen) })}
                    </p>
                    <p className="tnum text-body text-ink-muted">
                      {room.meter ? t('house.meterReading', { prev: room.meter.prevKwh, curr: room.meter.currKwh }) : t('house.noMeter')}
                    </p>
                    {delta !== null ? (
                      <p className={`tnum text-body font-semibold ${delta < 0 ? 'text-danger' : 'text-primary-dark'}`}>
                        {delta < 0 ? t('house.readingBackwards') : t('house.usage', { kwh: delta })}
                      </p>
                    ) : (
                      <p className="text-body text-ink-muted">{t('house.meterOffNote')}</p>
                    )}
                  </div>
                  <Button variant="secondary" onClick={() => openEditor(room)} icon={<Pencil size={15} />}>
                    {t('common.edit')}
                  </Button>
                </div>
              </Card>
            );
          })}
          {common ? (
            <Card className="px-3 py-3">
              <div className="od-row" style={{ ['--od-gap' as string]: '10px' }}>
                <Plug size={18} className="flex-none text-primary" />
                <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '3px' }}>
                  <span className="text-body font-semibold text-ink">{t('house.commonArea')}</span>
                  <span className="tnum text-body text-ink-muted">
                    {common.meter
                      ? t('house.meterReading', { prev: common.meter.prevKwh, curr: common.meter.currKwh })
                      : t('house.noMeter')}
                  </span>
                </div>
              </div>
            </Card>
          ) : null}
        </Stack>

        <Stack gap={10}>
          <h2 className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {t('house.members')}
          </h2>
          {members.map((member) => {
            const lines = statementFor(state, member.id, t);
            const outstanding = sumSen(lines.map((line) => line.outstandingSen));
            return (
              <Card key={member.id} className="px-3 py-3">
                <MemberLine
                  member={member}
                  room={roomFor(state, member)}
                  sub={member.id === me.id ? t('setup.you') : undefined}
                  trailing={
                    <div className="od-stack od-fixed items-end" style={{ ['--od-gap' as string]: '2px' }}>
                      <Amount value={ringgit(outstanding)} size="body" />
                      <span className="text-micro text-ink-muted">{t('house.balance')}</span>
                    </div>
                  }
                />
                <div className="mt-2 od-row" style={{ ['--od-gap' as string]: '8px' }}>
                  <Button variant="secondary" onClick={() => setStatement(member.id)}>
                    {t('house.statement')}
                  </Button>
                  {member.id === me.id ? <Pill tone="brand">{t('setup.you')}</Pill> : null}
                </div>
              </Card>
            );
          })}
        </Stack>

        <Stack gap={10}>
          <h2 className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {t('act.title')}
          </h2>
          <p className="-mt-1 text-body text-ink-muted">{t('act.body')}</p>
          {feed.length === 0 ? (
            <EmptyState title={t('act.emptyTitle')} body={t('act.emptyBody')} />
          ) : (
            <Card className="px-3 py-1">
              <ul>
                {shownFeed.map((row, index) => (
                  <li
                    key={row.entry.id}
                    className={`flex items-start gap-3 py-2.5 ${index > 0 ? 'border-t border-line' : ''}`}
                  >
                    <Avatar
                      initials={row.actorInitials || row.actorName.slice(0, 2).toUpperCase()}
                      size={30}
                      src={getAvatarSrc(row.actorInitials)}
                    />
                    <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
                      <span className="text-body text-ink">{row.entry.summary}</span>
                      <span className="od-row text-micro text-ink-muted" style={{ ['--od-gap' as string]: '6px' }}>
                        <span>{t(`act.kind.${row.entry.kind}` as const)}</span>
                        <span aria-hidden="true">&middot;</span>
                        <span>{formatRelative(row.entry.at, lang)}</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {feed.length > 5 ? (
            <Button variant="secondary" full onClick={() => setShowAllActivity(!showAllActivity)}>
              {showAllActivity ? t('act.showLess') : `${t('act.showAll')} (${feed.length})`}
            </Button>
          ) : null}
        </Stack>

        <Card className="px-3 py-3">
          <div className="od-stack" style={{ ['--od-gap' as string]: '8px' }}>
            <p className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
              {t('house.landlordAccess')}
            </p>
            <p className="text-body font-semibold text-ink">{t('house.landlordRow')}</p>
            <p className="text-body text-ink-muted">{t('house.landlordBody')}</p>
            <Button variant="secondary" full href="/landlord/">
              {t('house.preview')}
            </Button>
          </div>
        </Card>

        <Card className="px-3 py-3">
          <div className="od-stack" style={{ ['--od-gap' as string]: '8px' }}>
            <p className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
              {t('house.settings')}
            </p>
            <div className="od-row text-body" style={{ ['--od-gap' as string]: '8px' }}>
              <span className="od-fill text-ink-muted">{t('house.rentDueDay')}</span>
              <span className="tnum font-semibold text-ink">
                {state.house.rentDueDay} · {formatDate(`2026-09-${String(state.house.rentDueDay).padStart(2, '0')}`, lang)}
              </span>
            </div>
            <div className="od-row text-body" style={{ ['--od-gap' as string]: '8px' }}>
              <span className="od-fill text-ink-muted">{t('house.cadence')}</span>
              <span className="tnum font-semibold text-ink">
                {state.house.reminderCadence.map((days) => `T−${days}`).join(' · ')}
              </span>
            </div>
            <div className="od-row text-body" style={{ ['--od-gap' as string]: '8px' }}>
              <span className="od-fill text-ink-muted">{t('house.defaultMethod')}</span>
              <span className="font-semibold text-ink">{t('method.submeterShort')}</span>
            </div>
            <Button variant="secondary" full href="/setup/">
              {t('setup.title')}
            </Button>
            <MathNote>{t('acc.demoBody')}</MathNote>
          </div>
        </Card>

        <div className="pb-2" />
      </div>

      <Sheet
        open={editRoom !== null}
        onClose={() => setEditRoom(null)}
        title={t('house.roomEditor')}
        footer={
          <Button full onClick={saveRoom} icon={<Check size={18} />}>
            {t('common.save')}
          </Button>
        }
      >
        <Stack gap={12}>
          <Notice tone="neutral" title={editRoom?.name ?? ''} body={t('house.meterOffNote')} />
          <Field label={t('house.rent')}>
            <TextInput inputMode="decimal" value={rent} onChange={(event) => setRent(event.target.value)} />
          </Field>
          <button
            type="button"
            role="switch"
            aria-checked={hasMeter}
            onClick={() => setHasMeter(!hasMeter)}
            className="ss-focus-ring od-row rounded-btn border border-line bg-white px-3 py-2 text-body font-semibold text-ink"
            style={{ ['--od-gap' as string]: '8px' }}
          >
            <span className="od-fill od-truncate text-left">{t('house.meterSwitch')}</span>
            {hasMeter ? <Check size={16} className="flex-none text-primary" /> : null}
          </button>
          {hasMeter ? (
            <div className="grid grid-cols-2 gap-2">
              <Field label={t('house.prevReading')}>
                <TextInput inputMode="numeric" value={prev} onChange={(event) => setPrev(event.target.value)} />
              </Field>
              <Field label={t('house.currReading')}>
                <TextInput inputMode="numeric" value={curr} onChange={(event) => setCurr(event.target.value)} />
              </Field>
            </div>
          ) : null}
          {hasMeter && Number(curr) < Number(prev) ? (
            <Notice tone="amber" title={t('house.readingBackwards')} />
          ) : null}
        </Stack>
      </Sheet>

      <Sheet
        open={statementMember !== undefined}
        onClose={() => setStatement(null)}
        title={t('house.statementTitle', { name: statementMember?.name ?? '' })}
      >
        <Stack gap={12}>
          <ul className="overflow-hidden rounded-card border border-line bg-white">
            {lines.map((line) => (
              <li key={line.bill.id} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
                <span className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
                  <span className="text-body font-semibold text-ink">{localize(line.bill.title, lang)}</span>
                  <span className="tnum text-micro text-ink-muted">
                    {formatPeriod(line.bill.period, lang)} · {t('pay.shareOf', { amount: ringgit(line.shareSen) })}
                  </span>
                </span>
                <PayStatePill state={line.state} t={t} />
                <Amount value={ringgit(line.outstandingSen)} size="body" />
              </li>
            ))}
          </ul>
          <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
            <span className="od-fill text-body font-semibold text-ink">{t('house.statementTotal')}</span>
            <Amount
              value={ringgit(sumSen(lines.map((line) => line.outstandingSen)))}
              size="page"
            />
          </div>
          <MathNote>{t('bill.noCustody')}</MathNote>
          <a href={rel('/bills/')} className="ss-focus-ring text-body font-semibold text-primary">
            {t('bills.title')}
          </a>
        </Stack>
      </Sheet>
    </>
  );
}
