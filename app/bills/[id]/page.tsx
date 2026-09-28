import { BillDetailScreen } from '@/components/BillDetailScreen';
import { createSeedState } from '@/lib/seed';

export const dynamicParams = false;

/** The seeded bills are pre-rendered so a deep link works on a static host. */
export function generateStaticParams() {
  return createSeedState().bills.map((bill) => ({ id: bill.id }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BillDetailScreen billId={id} />;
}
