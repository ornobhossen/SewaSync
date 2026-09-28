'use client';

import { useRef, useState } from 'react';
import { Camera, Check, ScanLine } from 'lucide-react';
import { useActions, useStore } from '@/lib/store';
import { rowFor } from '@/lib/selectors';
import { ringgit } from '@/lib/money';
import { getRepairImage } from '@/lib/images';
import { useRelHref } from '@/lib/routes';
import { Button, Card, Field, Notice, PhotoStub, Pill, Stack, TextInput } from './ui';
import { MathNote, ShareStatusPill } from './common';
import { PageHeader } from './Shell';
import { useToast } from './Toast';

export function SnapScreen() {
  const { state, t } = useStore();
  const rel = useRelHref();
  const { updateRoom } = useActions();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [reading, setReading] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const elec = state.bills.find((bill) => bill.category === 'electricity');
  const room = state.rooms.find((item) => !item.isCommon && item.meter);
  const row = elec ? rowFor(state, elec, state.currentMemberId, t) : undefined;

  const detected = Number(reading) > 0 ? Math.round(Number(reading)) : null;
  const backwards = room?.meter && detected !== null && detected < room.meter.prevKwh;

  return (
    <>
      <PageHeader title={t('meter.title')} backHref="/" />
      <div className="ss-pad od-stack pt-3" style={{ ['--od-gap' as string]: '14px' }}>
        <Notice tone="amber" title={t('meter.notReal')} />

        <Field label={t('meter.photo')} hint={t('meter.checkBody')}>
          {photo ? <PhotoStub label={photo} ratio="4 / 3" /> : <PhotoStub label={t('meter.photoPlaceholder')} ratio="4 / 3" src={getRepairImage('electrical')} />}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => setPhoto(event.target.files?.[0]?.name ?? null)}
          />
          <Button variant="secondary" icon={<Camera size={16} />} onClick={() => fileInput.current?.click()}>
            {photo ? t('rep.changePhoto') : t('meter.photoPlaceholder')}
          </Button>
        </Field>

        <Field label={t('meter.previous')}>
          <TextInput
            inputMode="numeric"
            value={room?.meter ? String(room.meter.prevKwh) : ''}
            onChange={() => undefined}
            readOnly
          />
        </Field>

        <Field label={t('meter.detected')}>
          <TextInput
            inputMode="numeric"
            value={reading}
            onChange={(event) => {
              setReading(event.target.value.replace(/[^\d]/g, ''));
              setConfirmed(false);
            }}
          />
        </Field>

        {detected !== null ? (
          <Card className="px-3 py-3">
            <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
              <ScanLine size={18} className="flex-none text-primary" />
              <span className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
                <span className="tnum text-page font-bold text-ink">
                  {room?.meter ? detected - room.meter.currKwh : 0} kWh
                </span>
                <span className="text-micro text-ink-muted">
                  {room?.name ?? '—'} · {t('deriv.totalUsage')}
                </span>
              </span>
              {confirmed ? <Pill tone="paid">{t('meter.confirm')}</Pill> : null}
            </div>
          </Card>
        ) : null}

        {backwards ? <Notice tone="amber" title={t('house.readingBackwards')} /> : null}

        <Stack gap={10}>
          <Button
            full
            icon={<Check size={18} />}
            disabled={detected === null || Boolean(backwards) || confirmed || !room}
            onClick={() => {
              if (!room || detected === null) return;
              updateRoom(room.id, {
                meter: { prevKwh: room.meter?.prevKwh ?? 0, currKwh: detected },
              });
              setConfirmed(true);
              toast(t('meter.confirm'));
            }}
          >
            {t('meter.confirm')}
          </Button>
          {confirmed ? (
            <Button
              variant="secondary"
              full
              onClick={() => {
                window.location.assign(rel(elec ? `/bills/view/?id=${elec.id}` : '/bills/'));
              }}
            >
              {t('meter.useIn')}
            </Button>
          ) : null}
          <Button variant="ghost" full onClick={() => window.location.assign(rel('/'))}>
            {t('meter.cancel')}
          </Button>
        </Stack>

        {row ? (
          <MathNote>
            {t('bills.yourShare', { amount: ringgit(row.shareSen) })} <ShareStatusPill row={row} t={t} />
          </MathNote>
        ) : null}

        <div className="pb-2" />
      </div>
    </>
  );
}
