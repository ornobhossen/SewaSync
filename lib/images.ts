import type { TicketCategory } from './types';

/* ------------------------------------------------------------------ */
/* repair photos                                                       */
/* ------------------------------------------------------------------ */

/**
 * One photo per category, each picked to actually show the fault the
 * category describes, so a ticket never gets a picture of the wrong thing.
 *
 * `other` is deliberately absent: we have no verified photo for a generic
 * ticket, and showing a confidently wrong photo is worse than the plain
 * reference tile, which is what `getRepairImage` falls back to.
 */
const REPAIR_IMAGE_BY_CATEGORY: Partial<Record<TicketCategory, string>> = {
  aircon: '/images/repairs/repair-aircon-leaking.jpg',
  plumbing: '/images/repairs/repair-plumbing.jpg',
  electrical: '/images/repairs/repair-electrical.jpg',
  appliance: '/images/repairs/repair-water-heater.jpg',
  structural: '/images/repairs/repair-window.jpg',
};

/**
 * The photo for a repair category, or `undefined` when we have nothing that
 * honestly matches. Callers pass that straight to `PhotoStub`, which then
 * renders the neutral `IMG_nnnn` reference tile instead of a wrong photo.
 */
export function getRepairImage(category: TicketCategory | string): string | undefined {
  return REPAIR_IMAGE_BY_CATEGORY[category as TicketCategory];
}

/* ------------------------------------------------------------------ */
/* people                                                              */
/* ------------------------------------------------------------------ */

/**
 * Avatar per seeded member, keyed by initials. Hand-picked so the face
 * matches the person: `AH` is on `avatar-8`, which is a man.
 *
 * Anyone not listed here (a member added during the demo) gets no file and
 * falls back to their initials in `Avatar`, which is always correct.
 */
const AVATAR_BY_INITIALS: Record<string, string> = {
  AH: '/images/avatars/avatar-8.png',
  NI: '/images/avatars/avatar-2.png',
  KS: '/images/avatars/avatar-3.png',
  WY: '/images/avatars/avatar-4.png',
  ER: '/images/avatars/avatar-7.png',
};

export function getAvatarSrc(initials: string): string | undefined {
  return AVATAR_BY_INITIALS[initials];
}
