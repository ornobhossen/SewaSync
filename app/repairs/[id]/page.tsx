import { RepairDetailScreen } from '@/components/RepairDetailScreen';
import { createSeedState } from '@/lib/seed';

export const dynamicParams = false;

/** The seeded tickets are pre-rendered so a deep link works on a static host. */
export function generateStaticParams() {
  return createSeedState().tickets.map((ticket) => ({ id: ticket.id }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RepairDetailScreen ticketId={id} />;
}
