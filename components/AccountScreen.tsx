'use client';

import { useState } from 'react';
import {
  Bell,
  ChevronRight,
  CreditCard,
  FileText,
  HelpCircle,
  MessageCircle,
  ShieldCheck,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { useActions, useStore } from '@/lib/store';
import { currentMember, roomFor, unreadCount } from '@/lib/selectors';
import { formatDate } from '@/lib/dates';
import { ringgit } from '@/lib/money';
import { useRelHref } from '@/lib/routes';
import { Avatar, Button, Card, Notice, Pill, Stack, Toggle } from './ui';
import { getAvatarSrc } from '@/lib/images';
import { MathNote } from './common';
import { DemoPill, PageHeader } from './Shell';
import { useToast } from './Toast';

export function AccountScreen() {
  const { state, t, lang } = useStore();
  const { setLang, reset } = useActions();
  const toast = useToast();
  const [notify, setNotify] = useState(true);
  const me = currentMember(state);
  const room = roomFor(state, me);
  const sub = state.subscription;
  const unread = unreadCount(state);

  return (
    <>
      <PageHeader title={t('acc.title')} kicker={state.house.name} action={<DemoPill />} />
      <div className="ss-pad od-stack pt-3" style={{ ['--od-gap' as string]: '14px' }}>
        <Card className="px-3 py-3">
          <div className="od-row" style={{ ['--od-gap' as string]: '12px' }}>
            <Avatar initials={me.initials} size={48} src={getAvatarSrc(me.initials)} />
            <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
              <span className="text-page font-bold text-ink">{me.name}</span>
              <span className="text-body text-ink-muted">
                {room?.name ?? '—'} · {t(`house.role.${me.role === 'owner' ? 'owner' : me.role}` as const)}
              </span>
            </div>
            {unread > 0 ? <Pill tone="partial">{unread}</Pill> : null}
          </div>
        </Card>

        <Card className="px-3 py-3">
          <div className="od-stack" style={{ ['--od-gap' as string]: '8px' }}>
            <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
              <span className="flex h-9 w-9 items-center justify-center rounded-btn bg-primary-soft text-primary-dark">
                <Sparkles size={18} />
              </span>
              <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
                <span className="text-body font-semibold text-ink">{t('acc.plan')}</span>
                <span className="text-micro text-ink-muted">
                  {t('home.subActive', { n: sub.memberIds.length, total: state.members.filter((m) => m.role !== 'landlord').length })}
                </span>
              </div>
              <span className="tnum text-body font-bold text-ink">{ringgit(sub.priceSen)}</span>
            </div>
            <p className="text-body text-ink-muted">{t('acc.planBody')}</p>
            <p className="text-body font-semibold text-primary-dark">
              {t('acc.renews', { date: formatDate(sub.renewalAt, lang) })}
            </p>
            <Button
              variant="secondary"
              full
              onClick={() => toast(t('acc.renews', { date: formatDate(sub.renewalAt, lang) }))}
            >
              {t('acc.renew')}
            </Button>
          </div>
        </Card>

        <Stack gap={10}>
          <h2 className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {t('acc.notifications')}
          </h2>
          <Card className="divide-y divide-line">
            <div className="px-3 py-2">
              <Toggle checked={notify} onChange={setNotify} label={t('acc.notificationsBody')} />
            </div>
            <Row
              icon={<CreditCard size={18} />}
              label={t('acc.paymentMethods')}
              value={t('acc.paymentMethodsBody')}
              href="/bills/"
            />
            <Row
              icon={<Bell size={18} />}
              label={t('rem.title')}
              value={`${unread}`}
              href="/reminders/"
            />
          </Card>
        </Stack>

        <Stack gap={10}>
          <h2 className="text-label font-semibold uppercase tracking-[0.08em] text-ink-muted">
            {t('acc.language')}
          </h2>
          <Card className="px-3 py-3">
            <div className="od-row" style={{ ['--od-gap' as string]: '8px' }}>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`ss-focus-ring od-touch flex-1 rounded-btn border px-3 py-2 text-body font-semibold ${
                  lang === 'en' ? 'border-primary bg-primary-soft text-primary-dark' : 'border-line bg-white text-ink'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLang('bm')}
                className={`ss-focus-ring od-touch flex-1 rounded-btn border px-3 py-2 text-body font-semibold ${
                  lang === 'bm' ? 'border-primary bg-primary-soft text-primary-dark' : 'border-line bg-white text-ink'
                }`}
              >
                Bahasa Malaysia
              </button>
            </div>
            <p className="mt-2 text-body text-ink-muted">{t('acc.languageBody')}</p>
          </Card>
        </Stack>

        <Stack gap={10}>
          <Card className="divide-y divide-line">
            <Row icon={<HelpCircle size={18} />} label={t('acc.help')} href="/reminders/" />
            <Row icon={<MessageCircle size={18} />} label={t('acc.whatsapp')} value={t('acc.whatsappBody')} href="/account/" />
            <Row icon={<FileText size={18} />} label={t('acc.terms')} href="/account/" />
            <Row icon={<Sliders size={18} />} label={t('demo.title')} href="/demo/" />
            <Row icon={<ShieldCheck size={18} />} label={t('house.landlordRow')} href="/landlord/" />
          </Card>
        </Stack>

        <Notice tone="neutral" title={t('acc.demo')} body={t('acc.demoBody')} />

        <Button
          variant="danger"
          full
          onClick={() => {
            reset();
            toast(t('demo.resetDone'));
          }}
        >
          {t('acc.signOut')}
        </Button>

        <MathNote>{t('bill.noCustody')}</MathNote>
        <div className="pb-2" />
      </div>
    </>
  );
}

function Row({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  href: string;
}) {
  const rel = useRelHref();
  return (
    <a href={rel(href)} className="ss-focus-ring od-row ss-row-press px-3 py-3" style={{ ['--od-gap' as string]: '12px' }}>
      <span className="flex-none text-primary">{icon}</span>
      <span className="od-stack od-fill" style={{ ['--od-gap' as string]: '2px' }}>
        <span className="text-body font-semibold text-ink">{label}</span>
        {value ? <span className="text-micro text-ink-muted">{value}</span> : null}
      </span>
      <ChevronRight size={16} className="flex-none text-ink-muted" />
    </a>
  );
}
