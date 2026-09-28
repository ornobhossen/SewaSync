'use client';

import { useRef, useState } from 'react';
import { Camera, Send } from 'lucide-react';
import { useActions, useStore } from '@/lib/store';
import { NOW_ISO } from '@/lib/dates';
import { getRepairImage } from '@/lib/images';
import { useRelHref } from '@/lib/routes';
import type { Ticket, TicketCategory } from '@/lib/types';
import { Button, Field, Notice, PhotoStub, Select, Stack, TextArea, TextInput } from './ui';
import { MathNote } from './common';
import { PageHeader } from './Shell';
import { useToast } from './Toast';

const CATEGORIES: TicketCategory[] = ['aircon', 'plumbing', 'electrical', 'appliance', 'structural', 'other'];

export function RepairNewScreen() {
  const { state, t } = useStore();
  const { addTicket } = useActions();
  const rel = useRelHref();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const rooms = state.rooms.filter((room) => !room.isCommon);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('aircon');
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!photo) {
      setError(t('rep.photoRequired'));
      return;
    }
    if (!title.trim()) {
      setError(t('rep.titleField'));
      return;
    }
    const ticket: Ticket = {
      id: `t-${Date.now().toString(36)}`,
      title: { en: title, bm: title },
      description: { en: description || title, bm: description || title },
      category,
      roomId,
      photo,
      status: 'reported',
      reportedBy: state.currentMemberId,
      reportedAt: NOW_ISO,
      activity: [{ id: `ta-${Date.now().toString(36)}`, at: NOW_ISO, by: state.currentMemberId, to: 'reported' }],
    };
    addTicket(ticket);
    toast(t('rep.submitted'));
    window.location.assign(rel('/repairs/'));
  };

  return (
    <>
      <PageHeader title={t('rep.new')} backHref="/repairs/" />
      <div className="ss-pad od-stack pt-3" style={{ ['--od-gap' as string]: '14px' }}>
        <Notice tone="brand" title={t('rep.photoRequired').split('.')[0]} body={t('rep.photoRequired')} />

        <Field label={t('rep.whatBroken')} error={error ?? undefined}>
          <TextInput
            value={title}
            placeholder={t('rep.titlePlaceholder')}
            onChange={(event) => {
              setTitle(event.target.value);
              setError(null);
            }}
          />
        </Field>

        <Field label={t('rep.describe')}>
          <TextArea
            value={description}
            placeholder={t('rep.describePlaceholder')}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <Field label={t('rep.category')}>
          <Select value={category} onChange={(event) => setCategory(event.target.value as TicketCategory)}>
            {CATEGORIES.map((item) => (
              <option key={item} value={item}>
                {t(`rep.cat.${item}` as const)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('rep.room')}>
          <Select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('rep.photo')} error={error === t('rep.photoRequired') ? t('rep.photoRequired') : undefined}>
          {photo ? <PhotoStub label={photo} ratio="4 / 3" /> : <PhotoStub label={t(`rep.cat.${category}`)} ratio="4 / 3" src={getRepairImage(category)} />}          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              setPhoto(event.target.files?.[0]?.name ?? null);
              setError(null);
            }}
          />
          <Button variant="secondary" icon={<Camera size={16} />} onClick={() => fileInput.current?.click()}>
            {photo ? t('rep.changePhoto') : t('rep.attach')}
          </Button>
        </Field>

        <Stack gap={10}>
          <Button full icon={<Send size={18} />} onClick={submit}>
            {t('rep.submit')}
          </Button>
          <MathNote>{t('rep.landlordNote')}</MathNote>
        </Stack>
        <div className="pb-2" />
      </div>
    </>
  );
}
