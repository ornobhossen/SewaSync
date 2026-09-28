import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { StoreProvider } from '@/lib/store';
import { ToastProvider } from '@/components/Toast';
import { Shell } from '@/components/Shell';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
  fallback: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://sewasync.app'),
  title: 'SewaSync — fair bills, no awkward reminders',
  description:
    'Shared house bills worked out fairly for Malaysian student rentals: sub-meter electricity splits, equal shares, payment records, neutral reminders and repairs.',
  applicationName: 'SewaSync',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'SewaSync' },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'SewaSync',
    description: 'Fair bills, no awkward reminders. Shared student housing coordination.',
    siteName: 'SewaSync',
    locale: 'en_MY',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0F766E',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>
        <StoreProvider>
          <ToastProvider>
            <Shell>{children}</Shell>
          </ToastProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
