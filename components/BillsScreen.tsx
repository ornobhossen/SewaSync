'use client';

import { useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { houseTotals, isUtilityCategory, rowsFor, visibleBills } from '@/lib/selectors';
import { percent, ringgit } from '@/lib/money';
import { Button, Card, EmptyState, IconButton, Notice, Segmented, Stack } from './ui';
import { BillCard } from './common';
import { PageHeader } from './Shell';

type Filter = 'all' | 'utilities' | 'rent' | 'other';

export function BillsScreen() {
  const { state, t, lang } = useStore();
  const [filter, setFilter] = useState<Filter>('all');
  const totals = houseTotals(state);

  const all = visibleBills(state);
  const drafts = all.filter((bill) => !bill.sentToMembers);
  const filtered = all.filter((bill) => {
    if (filter === 'all') return true;
    if (filter === 'rent') return bill.category === 'rent';
    if (filter === 'utilities') return isUtilityCategory(bill.category);
    return bill.category === 'groceries' || bill.category === 'other';
  });

  return (
    <>
      <PageHeader
        title={t('bills.title')}
        action={<IconButton href="/bills/new/" label={t('bills.fab')}><Plus size={22} /></IconButton>}
      />
      <div className="ss-pad od-stack pt-3" style={{ ['--od-gap' as string]: '14px' }}>
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('bills.seg.all') },
            { value: 'utilities', label: t('bills.seg.utilities') },
            { value: 'rent', label: t('bills.seg.rent') },
            { value: 'other', label: t('bills.seg.other') },
          ]}
        />

        <Card className="px-3 py-3">
          <div className="od-stack" style={{ ['--od-gap' as string]: '4px' }}>
            <p className="text-body font-semibold text-ink">
              {t('bills.summary', {
                n: totals.billCount,
                amount: ringgit(totals.billed),
                pct: percent(totals.paid, totals.billed, 0),
              })}
            </p>
            <p className="text-body text-ink-muted">
              {t('bills.yourShare', {
                amount: ringgit(
                  filtered
                    .flatMap((bill) => rowsFor(state, bill, t))
                    .filter((row) => row.memberId === state.currentMemberId)
                    .reduce((total, row) => total + row.outstandingSen, 0),
                ),
              })}
            </p>
          </div>
        </Card>

        {drafts.length > 0 ? <Notice tone="neutral" title={t('status.draft')} body={t('bills.draftNote')} /> : null}

        {filtered.length === 0 ? (
          <EmptyState
            icon={<FileText size={20} />}
            title={all.length === 0 ? t('bills.emptyTitle') : t('bills.filteredEmpty', { filter: t(`bills.seg.${filter === 'all' ? 'all' : filter}`) })}
            body={t('bills.emptyBody')}
            action={<Button href="/bills/new/">{t('bills.emptyAction')}</Button>}
          />
        ) : (
          <Stack gap={10}>
            {filtered.map((bill) => (
              <BillCard
                key={bill.id}
                row={rowsFor(state, bill, t).find((row) => row.memberId === state.currentMemberId) ?? rowsFor(state, bill, t)[0]}
                t={t}
                lang={lang}
              />
            ))}
          </Stack>
        )}

        <div className="pb-2" />
      </div>
    </>
  );
}
