import type { Sen } from './types';

/**
 * Every ringgit figure in SewaSync is integer sen. Nothing here accepts or
 * returns a float amount — `parseAmountToSen` is the only place a human typed
 * string becomes money, and it rounds to the nearest sen once.
 */

export function ringgit(sen: Sen, opts: { signed?: boolean } = {}): string {
  const value = Math.trunc(sen);
  const negative = value < 0;
  const abs = Math.abs(value);
  const major = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const minor = (abs % 100).toString().padStart(2, '0');
  const body = `RM ${major}.${minor}`;
  if (negative && opts.signed) return `-${body}`;
  return body;
}

/** "RM 412.80" → 41280. Accepts "412.8", "412,80", "1 234.56", "RM 1,234.56". */
export function parseAmountToSen(input: string): Sen | null {
  const cleaned = input.replace(/[^\d.,]/g, '').replace(/,/g, '.');
  if (!cleaned) return null;
  const parts = cleaned.split('.');
  if (parts.length > 2) return null;
  const major = parts[0] === '' ? 0 : Number(parts[0]);
  if (!Number.isFinite(major)) return null;
  const minorRaw = parts.length === 2 ? parts[1] : '';
  if (parts.length === 2 && !/^\d{1,2}$/.test(minorRaw)) return null;
  const minor = minorRaw === '' ? 0 : Number(minorRaw.padEnd(2, '0'));
  if (!Number.isFinite(minor)) return null;
  return Math.round(major * 100) + minor;
}

export function sumSen(values: Sen[]): Sen {
  return values.reduce((total, value) => total + Math.trunc(value), 0);
}

/** Percentage for the derivation lines: 205 ÷ 627 → "32.70%". */
export function percent(numerator: number, denominator: number, dp = 2): string {
  if (!denominator) return '0.00%';
  return `${((numerator / denominator) * 100).toFixed(dp)}%`;
}

/** Compact form, only used above RM 10,000 so ledger figures stay exact. */
export function abbreviate(sen: Sen): string {
  const abs = Math.abs(sen);
  if (abs < 1_000_000) return ringgit(sen);
  return `RM ${(sen / 1_000_000).toFixed(1)}k`;
}

/**
 * Largest-remainder distribution. `weights` are non-negative integers; the
 * returned shares always sum to `total` exactly, which is the whole reason
 * the engine can promise the parts equal the bill.
 */
export function distributeByWeight(
  total: Sen,
  weights: number[],
): { shares: Sen[]; remainders: number[]; denominator: number } {
  const denominator = weights.reduce((a, b) => a + b, 0);
  const n = weights.length;
  if (denominator === 0) {
    // Nothing to weigh: fall back to an equal division of the whole amount.
    const base = Math.floor(total / n);
    const shares = new Array<Sen>(n).fill(base);
    let leftover = total - base * n;
    for (let i = 0; i < n && leftover > 0; i += 1, leftover -= 1) shares[i] += 1;
    return { shares, remainders: new Array<number>(n).fill(0), denominator: 0 };
  }
  const numerators = weights.map((w) => total * w);
  const shares = numerators.map((num) => Math.floor(num / denominator));
  const remainders = numerators.map((num, i) => num - shares[i] * denominator);
  let leftover = total - shares.reduce((a, b) => a + b, 0);
  const order = remainders
    .map((remainder, index) => ({ remainder, index }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; leftover > 0 && order.length > 0; i += 1, leftover -= 1) {
    const target = order[i % order.length].index;
    shares[target] += 1;
  }
  return { shares, remainders, denominator };
}

/** Equal division of an amount across n people, still exact to the sen. */
export function equalSplit(total: Sen, n: number): Sen[] {
  return distributeByWeight(total, new Array<number>(n).fill(1)).shares;
}
