'use client';

import { useState } from 'react';
import { Check, ChevronLeft, Home, Plus, Trash2, UserPlus } from 'lucide-react';
import { useActions, useStore } from '@/lib/store';
import { currentMember } from '@/lib/selectors';
import { parseAmountToSen } from '@/lib/money';
import { NOW_ISO } from '@/lib/dates';
import type { House, Member, Room } from '@/lib/types';
import { Button, Card, Field, Notice, Select, Stack, TextInput } from './ui';
import { MathNote } from './common';
import { PageHeader } from './Shell';

interface RoomDraft {
  name: string;
  rent: string;
}

interface MemberDraft {
  name: string;
  /** index into the room draft list, so a rename never orphans a member */
  roomIndex: number;
}

/** "Aiman Hakimi" -> "AH", "Wong" -> "WO". Mirrors the seed's initials. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean)[0] ?? '';
}

/** A slug that stays readable in the invite URL and in localStorage. */
function slugOf(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'house'
  );
}

export function SetupScreen() {
  const { state, t } = useStore();
  const { createHouse } = useActions();
  const me = currentMember(state);
  const landlord = state.members.find((member) => member.id === state.house.landlordId);

  const [step, setStep] = useState(1);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);

  const [houseName, setHouseName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [rooms, setRooms] = useState<RoomDraft[]>([{ name: '', rent: '' }]);
  const [ownerName, setOwnerName] = useState(me.name);
  const [others, setOthers] = useState<MemberDraft[]>([]);
  const [touched, setTouched] = useState(false);

  const namedRooms = rooms.filter((room) => room.name.trim().length > 0);
  const stepError =
    step === 1 && houseName.trim().length === 0
      ? t('common.required')
      : step === 2 && namedRooms.length === 0
        ? t('common.required')
        : undefined;

  const addRoom = () => setRooms([...rooms, { name: '', rent: '' }]);

  const dropRoom = (index: number) => {
    setRooms(rooms.filter((_, at) => at !== index));
    setOthers(
      others.map((member) => ({
        ...member,
        // a dropped room pulls anyone who was in it back to the first room
        roomIndex: member.roomIndex === index ? 0 : member.roomIndex > index ? member.roomIndex - 1 : member.roomIndex,
      })),
    );
  };

  const addMember = () => setOthers([...others, { name: '', roomIndex: 0 }]);

  const dropMember = (index: number) =>
    setOthers(others.filter((_, at) => at !== index));

  const patchMember = (index: number, patch: Partial<MemberDraft>) =>
    setOthers(others.map((member, at) => (at === index ? { ...member, ...patch } : member)));

  const patchRoom = (index: number, patch: Partial<RoomDraft>) =>
    setRooms(rooms.map((room, at) => (at === index ? { ...room, ...patch } : room)));

  const next = () => {
    setTouched(true);
    if (stepError) return;
    setTouched(false);
    setStep(Math.min(3, step + 1));
  };

  const finish = () => {
    setTouched(true);
    if (stepError) return;

    // Room ids are positional so the member drafts can point at them, and
    // member ids are derived from the room so a second join cannot collide
    // with the first on the same device.
    const houseId = `h-${slugOf(houseName)}`;
    const roomList: Room[] = namedRooms.map((room, index) => ({
      id: `r${index + 1}`,
      name: room.name.trim(),
      rentSen: parseAmountToSen(room.rent),
      meter: null,
    }));

    const owner: Member = {
      id: `m-${slugOf(ownerName)}`,
      name: ownerName.trim(),
      firstName: firstNameOf(ownerName),
      initials: initialsOf(ownerName),
      roomId: roomList[0].id,
      role: 'owner',
      joinedAt: NOW_ISO.slice(0, 10),
      weight: 3,
    };

    const joined: Member[] = others
      .filter((member) => member.name.trim().length > 0)
      .map((member, index) => ({
        id: `m-${slugOf(member.name)}-${index + 1}`,
        name: member.name.trim(),
        firstName: firstNameOf(member.name),
        initials: initialsOf(member.name),
        roomId: (roomList[member.roomIndex] ?? roomList[0]).id,
        role: 'member' as const,
        joinedAt: NOW_ISO.slice(0, 10),
        weight: 2,
        // the allocation engine labels a metered member with no sub-meter,
        // so setup says so up front rather than letting it look like a bug
        noMeter: true,
      }));

    const house: House = {
      id: houseId,
      name: houseName.trim(),
      address: address.trim(),
      city: city.trim(),
      landlordId: landlord?.id ?? owner.id,
      rentDueDay: 1,
      reminderCadence: [3, 1, 0],
      defaultMethod: 'submeter',
      createdAt: NOW_ISO,
    };

    // The landlord is carried over rather than re-asked: the setup copy makes
    // no promise of naming them, and the landlord view needs a real member to
    // resolve `landlordId` against.
    const members = landlord
      ? [owner, ...joined, { ...landlord, role: 'landlord' as const }]
      : [owner, ...joined];

    createHouse(house, roomList, members, owner.id);
    setCreated({ id: houseId, name: house.name });
  };

  if (created) {
    return (
      <>
        <PageHeader title={t('setup.done')} kicker={t('setup.title')} />
        <div className="ss-pad od-stack pt-3" style={{ ['--od-gap' as string]: '14px' }}>
          <Card className="px-4 py-5 text-center">
            <div className="od-stack items-center" style={{ ['--od-gap' as string]: '10px' }}>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary-dark">
                <Check size={22} />
              </span>
              <p className="text-page font-bold text-ink">{t('setup.done')}</p>
              <p className="text-body text-ink-muted">{t('setup.doneBody')}</p>
            </div>
          </Card>
          <Button full href={`/setup/invite/?house=${created.id}`} icon={<UserPlus size={18} />}>
            {t('house.invite')}
          </Button>
          <Button full variant="secondary" href="/house/" icon={<Home size={18} />}>
            {t('join.openHouse')}
          </Button>
          <MathNote>{t('acc.demoBody')}</MathNote>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t('setup.title')}
        backHref={step > 1 ? undefined : '/house/'}
        kicker={t('common.step', { n: step })}
        action={
          step > 1 ? (
            <Button
              variant="ghost"
              onClick={() => setStep(step - 1)}
              icon={<ChevronLeft size={16} />}
            >
              {t('common.back')}
            </Button>
          ) : undefined
        }
      />

      <div className="ss-pad od-stack pt-3" style={{ ['--od-gap' as string]: '14px' }}>
        {step === 1 ? (
          <>
            <p className="text-body text-ink-muted">{t('setup.lead')}</p>
            <Card className="px-3 py-3">
              <Stack gap={12}>
                <Field
                  label={t('setup.houseName')}
                  error={touched && houseName.trim().length === 0 ? t('common.required') : undefined}
                >
                  <TextInput
                    value={houseName}
                    onChange={(event) => setHouseName(event.target.value)}
                    placeholder={t('setup.roomPlaceholder')}
                  />
                </Field>
                <Field label={t('setup.address')}>
                  <TextInput value={address} onChange={(event) => setAddress(event.target.value)} />
                </Field>
                <Field label={t('setup.city')}>
                  <TextInput value={city} onChange={(event) => setCity(event.target.value)} />
                </Field>
              </Stack>
            </Card>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div>
              <p className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {t('setup.roomsTitle')}
              </p>
              <p className="mt-1 text-body text-ink-muted">{t('house.roomsBody')}</p>
            </div>
            {touched && namedRooms.length === 0 ? (
              <Notice tone="amber" title={t('common.required')} />
            ) : null}
            {rooms.map((room, index) => (
              <Card key={`room-${index}`} className="px-3 py-3">
                <div className="od-stack" style={{ ['--od-gap' as string]: '10px' }}>
                  <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
                    <span className="tnum flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary-soft text-micro font-bold text-primary-dark">
                      {index + 1}
                    </span>
                    <span className="od-fill text-body font-semibold text-ink">
                      {room.name.trim() || t('setup.roomPlaceholder')}
                    </span>
                    {rooms.length > 1 ? (
                      <Button
                        variant="ghost"
                        onClick={() => dropRoom(index)}
                        icon={<Trash2 size={16} />}
                      >
                        {t('bill.delete')}
                      </Button>
                    ) : null}
                  </div>
                  <TextInput
                    value={room.name}
                    onChange={(event) => patchRoom(index, { name: event.target.value })}
                    placeholder={t('setup.roomPlaceholder')}
                  />
                  <Field label={t('house.rent')}>
                    <TextInput
                      inputMode="decimal"
                      value={room.rent}
                      onChange={(event) => patchRoom(index, { rent: event.target.value })}
                    />
                  </Field>
                </div>
              </Card>
            ))}
            <Button variant="secondary" full onClick={addRoom} icon={<Plus size={18} />}>
              {t('setup.addRoom')}
            </Button>
            <MathNote>{t('house.meterOffNote')}</MathNote>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div>
              <p className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {t('setup.membersTitle')}
              </p>
            </div>

            <Card className="px-3 py-3">
              <Stack gap={10}>
                <span className="text-label font-semibold uppercase tracking-[0.06em] text-ink-muted">
                  {t('setup.you')}
                </span>
                <TextInput
                  value={ownerName}
                  onChange={(event) => setOwnerName(event.target.value)}
                />
              </Stack>
            </Card>

            {others.map((member, index) => (
              <Card key={`member-${index}`} className="px-3 py-3">
                <div className="od-stack" style={{ ['--od-gap' as string]: '10px' }}>
                  <TextInput
                    value={member.name}
                    onChange={(event) => patchMember(index, { name: event.target.value })}
                    placeholder={t('setup.memberPlaceholder')}
                  />
                  <Field label={t('common.room')}>
                    <Select
                      value={member.roomIndex}
                      onChange={(event) => patchMember(index, { roomIndex: Number(event.target.value) })}
                    >
                      {namedRooms.map((room, roomIndex) => (
                        <option key={`pick-${roomIndex}`} value={roomIndex}>
                          {room.name.trim()}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button variant="ghost" onClick={() => dropMember(index)} icon={<Trash2 size={16} />}>
                    {t('bill.delete')}
                  </Button>
                </div>
              </Card>
            ))}

            <Button variant="secondary" full onClick={addMember} icon={<Plus size={18} />}>
              {t('setup.addMember')}
            </Button>

            <Notice tone="neutral" title={t('setup.landlord')} body={t('setup.landlordBody')} />
            <MathNote>{t('bill.noCustody')}</MathNote>
          </>
        ) : null}

        {step < 3 ? (
          <Button full onClick={next} icon={<ChevronLeft size={18} className="rotate-180" />}>
            {t('setup.next')}
          </Button>
        ) : (
          <Button full onClick={finish} icon={<Check size={18} />}>
            {t('setup.finish')}
          </Button>
        )}

        {stepError && touched ? <p className="text-body font-semibold text-danger">{stepError}</p> : null}
        <div className="pb-2" />
      </div>
    </>
  );
}
