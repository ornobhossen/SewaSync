'use client';

import { useEffect, useState } from 'react';
import { BillDetailScreen } from '@/components/BillDetailScreen';

/**
 * The bill sheet is reached as `/bills/view/?id=…`.
 *
 * The parameter is read in an effect rather than through `useSearchParams`,
 * which would wrap the screen in a Suspense boundary and leave the exported
 * HTML an empty skeleton. The static export therefore ships the real
 * "choose a bill" state, and the requested bill replaces it on hydration.
 */
export default function Page() {
  const [billId, setBillId] = useState('');

  useEffect(() => {
    setBillId(new URLSearchParams(window.location.search).get('id') ?? '');
  }, []);

  return <BillDetailScreen billId={billId} />;
}
