'use client';

import { useEffect, useState } from 'react';
import { PayScreen } from '@/components/PayForm';

/**
 * Payment is reached as `/bills/pay/?id=…&member=…`.
 *
 * The parameters are read in an effect rather than through `useSearchParams`,
 * which would wrap the screen in a Suspense boundary and leave the exported
 * HTML an empty skeleton. The static export therefore ships the real state,
 * and the requested bill replaces it on hydration.
 */
export default function Page() {
  const [billId, setBillId] = useState('');
  const [memberId, setMemberId] = useState<string | undefined>(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setBillId(params.get('id') ?? '');
    setMemberId(params.get('member') ?? undefined);
  }, []);

  return <PayScreen billId={billId} memberId={memberId} />;
}
