'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Bell,
  ChevronLeft,
  CloudOff,
  House,
  Plus,
  Receipt,
  SlidersHorizontal,
  User,
  Wrench,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { unreadCount } from '@/lib/selectors';
import { isCurrentPath, useRelHref } from '@/lib/routes';
import { IconButton } from './ui';

/* ------------------------------------------------------------------ */
/* device chrome                                                       */
/* ------------------------------------------------------------------ */

function DeviceChrome({ visible }: { visible: boolean }) {
  return (
    <>
      <div
        className="ss-status ss-chrome"
        aria-hidden="true"
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 300ms ease',
        }}
      >
        <span>9:41</span>
        <span className="ss-status-icons">
          <svg viewBox="0 0 18 12">
            <path d="M1 10.5h2V8H1v2.5Zm4 0h2V5.5H5v5Zm4 0h2V3H9v7.5Zm4 0h2V.5h-2v10Z" />
          </svg>
          <svg viewBox="0 0 18 12">
            <path d="M9 11.2 7.2 9.4a2.55 2.55 0 0 1 3.6 0L9 11.2Zm4.1-4.1-1.35 1.35a3.9 3.9 0 0 0-5.5 0L4.9 7.1a5.8 5.8 0 0 1 8.2 0Zm3-3-1.35 1.35a8.15 8.15 0 0 0-11.5 0L1.9 4.1a10.05 10.05 0 0 1 14.2 0Z" />
          </svg>
          <svg className="ss-battery" viewBox="0 0 27 12">
            <path
              fillRule="evenodd"
              d="M2.5 1h19A2.5 2.5 0 0 1 24 3.5v5a2.5 2.5 0 0 1-2.5 2.5h-19A2.5 2.5 0 0 1 0 8.5v-5A2.5 2.5 0 0 1 2.5 1Zm0 1A1.5 1.5 0 0 0 1 3.5v5A1.5 1.5 0 0 0 2.5 10h19A1.5 1.5 0 0 0 23 8.5v-5A1.5 1.5 0 0 0 21.5 2h-19Zm.5 1h17.5A1.5 1.5 0 0 1 22 4.5v3A1.5 1.5 0 0 1 20.5 9H3V3Zm22 1.5a1.5 1.5 0 0 1 0 3v-3Z"
            />
          </svg>
        </span>
      </div>
      <div
        className="ss-island ss-chrome"
        aria-hidden="true"
        style={{
          transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(-100%)',
          transition: 'transform 300ms ease',
        }}
      />
      <div
        className="ss-home ss-chrome"
        aria-hidden="true"
        style={{
          transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(100%)',
          transition: 'transform 300ms ease',
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* tab bar                                                             */
/* ------------------------------------------------------------------ */

const TABS = [
  { href: '/', icon: House, key: 'nav.home' },
  { href: '/bills/', icon: Receipt, key: 'nav.bills' },
  { href: '/repairs/', icon: Wrench, key: 'nav.repairs' },
  { href: '/house/', icon: SlidersHorizontal, key: 'nav.house' },
  { href: '/account/', icon: User, key: 'nav.account' },
] as const;

function TabBar() {
  const { state, t } = useStore();
  const unread = unreadCount(state);
  const rel = useRelHref();
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    // The export is not always mounted at a domain root, so the live pathname
    // carries a prefix the tab routes do not. Resolving each tab href against
    // the real document URL puts the two in the same coordinate space.
    const here = window.location.pathname;
    const current = TABS.find((tab) => {
      const target = new URL(rel(tab.href), window.location.href).pathname;
      return isCurrentPath(target, here);
    });
    setActiveTab(current ? current.href : null);
  }, [rel]);

  return (
    <nav
      aria-label={t('app.name')}
      className="border-t border-line bg-white/95 backdrop-blur"
      style={{ paddingBottom: 'var(--phone-safe-bottom)' }}
    >
      <ul className="flex items-stretch">
        {TABS.map((tab) => {
          const active = activeTab === tab.href;
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="od-fill">
              <a
                href={rel(tab.href)}
                aria-current={active ? 'page' : undefined}
                className={`ss-focus-ring flex flex-col items-center gap-[2px] py-2 text-[11px] font-semibold transition-colors duration-150 ${
                  active ? 'text-primary' : 'text-ink-muted'
                }`}
              >
                <span className="relative">
                  <Icon size={21} strokeWidth={active ? 2.4 : 1.9} />
                  {tab.href === '/' && unread > 0 ? (
                    <span className="absolute -right-1.5 -top-1 h-[8px] w-[8px] rounded-full bg-danger" />
                  ) : null}
                </span>
                <span className="od-truncate">{t(tab.key)}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* headers                                                             */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  backHref,
  action,
  kicker,
}: {
  title: string;
  backHref?: string;
  action?: ReactNode;
  kicker?: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 px-4 pb-3 pt-2 backdrop-blur">
      <div className="od-row" style={{ ['--od-gap' as string]: '10px' }}>
        {backHref ? (
          <IconButton href={backHref} label="back">
            <ChevronLeft size={22} />
          </IconButton>
        ) : null}
        <div className="od-stack od-fill" style={{ ['--od-gap' as string]: '0px' }}>
          {kicker ? (
            <span className="text-micro font-semibold uppercase tracking-[0.1em] text-ink-muted">
              {kicker}
            </span>
          ) : null}
          <h1 className="od-truncate text-page font-bold text-ink">{title}</h1>
        </div>
        {action}
      </div>
    </header>
  );
}

export function DemoPill() {
  const { t } = useStore();
  const rel = useRelHref();
  return (
    <a
      href={rel('/demo/')}
      className="ss-focus-ring inline-flex items-center gap-1 rounded-full border border-line bg-white px-2 py-[3px] text-micro font-bold uppercase tracking-[0.08em] text-ink"
    >
      {t('header.demo')}
    </a>
  );
}

export function HeaderActions({ invert }: { invert?: boolean }) {
  const { state, t } = useStore();
  const unread = unreadCount(state);
  return (
    <>
      <IconButton href="/reminders/" label={t('header.notifications')} badge={unread} invert={invert}>
        <Bell size={20} />
      </IconButton>
      <IconButton href="/bills/new/" label={t('header.addBill')} invert={invert}>
        <Plus size={22} />
      </IconButton>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* shell                                                               */
/* ------------------------------------------------------------------ */

function OfflineStrip() {
  const { t } = useStore();
  return (
    <div
      className="ss-offline"
      role="status"
      aria-live="polite"
    >
      <div className="od-row bg-[#FEF3C7] px-4 py-2 text-[#92400E]" style={{ ['--od-gap' as string]: '8px' }}>
        <CloudOff size={15} className="flex-none" />
        <span className="od-fill text-micro font-semibold leading-snug">{t('net.offline')}</span>
        <span className="flex-none text-[10px] font-bold uppercase tracking-[0.08em] opacity-80">
          {t('net.lastSynced')}
        </span>
      </div>
    </div>
  );
}

export function Shell({
  children,
  hideTabs,
  contentClassName = '',
}: {
  children: ReactNode;
  hideTabs?: boolean;
  contentClassName?: string;
}) {
  const [offline, setOffline] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const contentRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    let lastY = 0;
    const onScroll = () => {
      const y = el.scrollTop;
      if (y < 10) {
        setChromeVisible(true);
      } else if (y > lastY + 5) {
        setChromeVisible(false);
      } else if (y < lastY - 5) {
        setChromeVisible(true);
      }
      lastY = y;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="ss-stage">
      <div className="ss-frame" data-phone-shell data-platform="iphone">
        <span className="ss-hardware silent" aria-hidden="true" />
        <span className="ss-hardware volume-up" aria-hidden="true" />
        <span className="ss-hardware volume-down" aria-hidden="true" />
        <span className="ss-hardware power" aria-hidden="true" />
        <div className="ss-screen" data-phone-screen>
          <main className="ss-content" data-phone-content ref={contentRef}>
            <div className={`ss-app ${offline ? 'ss-app-offline' : ''} ${contentClassName}`}>
              {children}
            </div>
          </main>
          {hideTabs ? null : <TabBar />}
          {offline ? <OfflineStrip /> : null}
          <DeviceChrome visible={chromeVisible} />
        </div>
      </div>
    </div>
  );
}
