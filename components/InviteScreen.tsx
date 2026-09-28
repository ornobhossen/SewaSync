'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Home, UserPlus } from 'lucide-react';
import { useActions, useStore } from '@/lib/store';
import { NOW_ISO } from '@/lib/dates';
import type { Member } from '@/lib/types';
import { Button, Card, Field, Notice, Select, Stack, TextInput } from './ui';
import { MathNote } from './common';
import { PageHeader } from './Shell';
import { useToast } from './Toast';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function slugOf(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'member'
  );
}

/**
 * The invite half of setup: the owner copies a link, whoever opens it lands
 * here and puts their own name on the member list.
 *
 * The link is honoured honestly. A `house` id that is not the house on this
 * device is shown as an unknown invite rather than silently joined, because
 * there is no server to resolve it against.
 *
 * The `house` parameter is read in an effect rather than through
 * `useSearchParams`, which would force the whole screen behind a Suspense
 * boundary and leave the exported HTML an empty skeleton. This way the static
 * export ships the real house card and join form, and the query only refines
 * it once the page is interactive.
 */
export function InviteScreen() {
  const { state, t } = useStore();
  const { joinHouse } = useActions();
  const toast = useToast();

  const [houseId, setHouseId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [touched, setTouched] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('house');
    if (id) setHouseId(id);
  }, []);

  const house = state.house;
  const invited = houseId === null || houseId === '' || houseId === house.id;
  const rooms = state.rooms.filter((room) => !room.isCommon);
  const picked = roomId !== '' ? roomId : rooms[0]?.id ?? '';
  const nameMissing = name.trim().length === 0;
  const alreadyIn = state.members.some(
    (member) => member.name.trim().toLowerCase() === name.trim().toLowerCase() && name.trim().length > 0,
  );

  const inviteLink =
    typeof window === 'undefined' ? '' : `${window.location.origin}/setup/invite/?house=${house.id}`;

  const copy = () => {
    void navigator.clipboard?.writeText(inviteLink);
    toast(t('common.copied'));
  };

  const confirm = () => {
    setTouched(true);
    if (nameMissing || rooms.length === 0) return;
    const member: Member = {
      id: `m-${slugOf(name)}-${state.members.length + 1}`,
      name: name.trim(),
      firstName: name.trim().split(/\s+/).filter(Boolean)[0] ?? '',
      initials: initialsOf(name),
      roomId: picked,
      role: 'member',
      joinedAt: NOW_ISO.slice(0, 10),
      weight: 2,
      noMeter: true,
    };
    joinHouse(member);
    setJoined(true);
  };

  return (
    <>
      <PageHeader
        title={t('join.title')}
        kicker={house.name}
        backHref="/house/"
      />

      <div className="ss-pad od-stack pt-3" style={{ ['--od-gap' as string]: '14px' }}>
        {joined ? (
          <Card className="px-4 py-5 text-center">
            <div className="od-stack items-center" style={{ ['--od-gap' as string]: '10px' }}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary-dark">
                <Check size={22} />
              </span>
              <p className="text-page font-bold text-ink">
                {t('join.success', { house: house.name })}
              </p>
              <p className="text-body text-ink-muted">{t('join.successBody')}</p>
              <span className="tnum text-body text-ink-muted">
                {t('common.room')}: {rooms.find((room) => room.id === picked)?.name ?? '—'}
              </span>
              <Button full href="/house/" icon={<Home size={18} />}>
                {t('join.openHouse')}
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <Card className="px-3 py-3">
              <div className="od-stack" style={{ ['--od-gap' as string]: '6px' }}>
                <p className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  {t('join.houseCard')}
                </p>
                <p className="text-page font-bold text-ink">{house.name}</p>
                <p className="text-body text-ink-muted">
                  {house.address}, {house.city}
                </p>
                <p className="tnum text-body text-ink-muted">
                  {t('common.people')}: {state.members.filter((member) => member.role !== 'landlord').length}
                </p>
              </div>
            </Card>

            {!invited ? (
              <Notice
                tone="amber"
                title={t('join.title')}
                body={`?house=${houseId}`}
              />
            ) : null}

            <Field
              label={t('join.yourName')}
              error={touched && nameMissing ? t('join.errName') : undefined}
            >
              <TextInput
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('setup.memberPlaceholder')}
              />
            </Field>
            {alreadyIn ? <Notice tone="amber" title={t('setup.membersTitle')} body={name} /> : null}

            <Field
              label={t('join.pickRoom')}
              error={touched && rooms.length === 0 ? t('join.errRoom') : undefined}
            >
              <Select value={picked} onChange={(event) => setRoomId(event.target.value)}>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Button full onClick={confirm} icon={<UserPlus size={18} />}>
              {t('join.confirm')}
            </Button>

            <Card className="px-3 py-3">
              <Stack gap={8}>
                <p className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
                  {t('house.copyLink')}
                </p>
                <p className="od-truncate text-micro text-ink-muted">{inviteLink}</p>
                <Button variant="secondary" full onClick={copy} icon={<Copy size={16} />}>
                  {t('common.copy')}
                </Button>
              </Stack>
            </Card>

            <MathNote>{t('join.honest')}</MathNote>
          </>
        )}

        <div className="pb-2" />
      </div>
    </>
  );
}
