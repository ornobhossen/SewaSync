/**
 * Build `docs/wireframes.docx` — the Word edition of the wireframes.
 *
 * The HTML edition in `docs/wireframes.html` is the better artefact, but Word
 * cannot render it: Word's HTML importer implements roughly CSS 1.1, so the
 * flex/grid layout, the CSS custom properties and the print stylesheet are all
 * dropped on the floor. Pasting that file into a document yields a flat,
 * unreadable column of grey bars.
 *
 * So this emits a real OOXML `.docx` instead. The wireframe idiom that survives
 * Word is tables, which is also the idiom that *edits* well: every block on
 * every screen is a table cell, so a reviewer can retype a label, retint a row
 * or drag a block without touching markup.
 *
 * No dependencies. A `.docx` is a ZIP of XML parts, so this writes the ZIP
 * itself (see `zip()`) and emits the five parts Word actually requires.
 *
 *   node scripts/build-wireframes-docx.mjs
 */

import zlib from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs', 'wireframes.docx');

/* ================================================================== *
 * ZIP                                                                  *
 * ================================================================== */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** DOS date/time for 2026-09-15 09:41, so the archive is byte-stable. */
const DOS_TIME = (9 << 11) | (41 >> 5);
const DOS_DATE = ((2026 - 1980) << 9) | (9 << 5) | 15;

function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const [name, text] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const raw = Buffer.from(text, 'utf8');
    const body = zlib.deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(centrals.length / 2, 8);
  end.writeUInt16LE(centrals.length / 2, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuf, end]);
}

/* ================================================================== *
 * WordprocessingML primitives                                          *
 * ================================================================== */

const NB = '\u00A0';
const MONO = 'Consolas';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * A run of text. `sz` is in half-points, so 16 is 8pt.
 *
 * The `rPr` children are emitted in the order CT_RPr declares: rFonts, b, i,
 * caps, color, sz, szCs, bdr, shd. Word repairs some out-of-order properties
 * silently and refuses to open the file for others, so the sequence is not
 * negotiable.
 */
function r(text, o = {}) {
  const pr = [];
  if (o.font) pr.push(`<w:rFonts w:ascii="${o.font}" w:hAnsi="${o.font}" w:cs="${o.font}"/>`);
  if (o.b) pr.push('<w:b/>');
  if (o.i) pr.push('<w:i/>');
  if (o.caps) pr.push('<w:caps/>');
  if (o.color) pr.push(`<w:color w:val="${o.color}"/>`);
  if (o.sz) pr.push(`<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>`);
  if (o.bdr) pr.push(`<w:bdr w:val="single" w:sz="6" w:space="1" w:color="${o.bdr}"/>`);
  if (o.shd) pr.push(`<w:shd w:val="clear" w:fill="${o.shd}"/>`);
  const rpr = pr.length ? `<w:rPr>${pr.join('')}</w:rPr>` : '';
  // Newlines and tabs must become real <w:br/>/<w:tab/> elements. Left as
  // literal characters inside <w:t>, Word collapses both to plain spaces.
  const body = String(text)
    .split('\n')
    .map((line, i) => {
      const pieces = line
        .split('\t')
        .map((part, j) => (j ? '<w:tab/>' : '') + `<w:t xml:space="preserve">${esc(part)}</w:t>`)
        .join('');
      return (i ? '<w:br/>' : '') + pieces;
    })
    .join('');
  return `<w:r>${rpr}${body}</w:r>`;
}

const border = (side, colour = 'BFBFBF', sz = 6) =>
  `<w:${side} w:val="single" w:sz="${sz}" w:space="0" w:color="${colour}"/>`;
const noBorder = (side) => `<w:${side} w:val="nil"/>`;

/** Paragraph. `sp` is spacing in twips: `{ b: before, a: after, l: line }`. */
function p(runs = '', o = {}) {
  const pr = [];
  if (o.keep) pr.push('<w:keepNext/>');
  if (o.bottom) pr.push(`<w:pBdr>${border('bottom', o.bottom, o.bottomSz || 4)}</w:pBdr>`);
  if (o.shd) pr.push(`<w:shd w:val="clear" w:fill="${o.shd}"/>`);
  if (o.tab) pr.push(`<w:tabs><w:tab w:val="left" w:pos="${o.tab}"/></w:tabs>`);
  const sp = o.sp || {};
  pr.push(`<w:spacing w:before="${sp.b ?? 0}" w:after="${sp.a ?? 40}" w:line="${sp.l ?? 200}" w:lineRule="auto"/>`);
  if (o.ind) pr.push(`<w:ind w:left="${o.ind}"${o.hanging ? ` w:hanging="${o.hanging}"` : ''}/>`);
  if (o.align) pr.push(`<w:jc w:val="${o.align}"/>`);
  return `<w:p><w:pPr>${pr.join('')}</w:pPr>${runs}</w:p>`;
}

/**
 * Table cell. Child order follows the CT_TcPr schema sequence.
 *
 * A `w:tc` must end with a `w:p`, so when the content ends in a nested table we
 * append a hairline filler paragraph. Word silently drops the cell otherwise.
 */
function tc(paras, o = {}) {
  const pr = [`<w:tcW w:w="${o.w || 0}" w:type="dxa"/>`];
  if (o.span) pr.push(`<w:gridSpan w:val="${o.span}"/>`);
  if (o.borders) pr.push(`<w:tcBorders>${o.borders}</w:tcBorders>`);
  if (o.shd) pr.push(`<w:shd w:val="clear" w:fill="${o.shd}"/>`);
  pr.push(`<w:vAlign w:val="${o.vAlign || 'top'}"/>`);
  const items = (Array.isArray(paras) ? paras : [paras]).filter(Boolean);
  let body = items.length ? items.join('') : p('');
  if (!body.endsWith('</w:p>')) body += p('', { sp: { a: 0, l: 60 } });
  return `<w:tc><w:tcPr>${pr.join('')}</w:tcPr>${body}</w:tc>`;
}

const tr = (cells, o = {}) =>
  `<w:tr><w:trPr><w:cantSplit/>${
    o.h ? `<w:trHeight w:val="${o.h}" w:hRule="atLeast"/>` : ''
  }</w:trPr>${cells}</w:tr>`;

/** `cols` is the grid in twips; `width` must match its sum. */
function tbl(rows, o = {}) {
  const cols = o.cols;
  const width = o.width ?? cols.reduce((a, b) => a + b, 0);
  const pr = [`<w:tblW w:w="${width}" w:type="dxa"/>`];
  if (o.jc) pr.push(`<w:jc w:val="${o.jc}"/>`);
  pr.push(
    `<w:tblBorders>${
      o.borders
        ? ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
            .map((s) => border(s, o.borders, o.bordersSz || 6))
            .join('')
        : ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(noBorder).join('')
    }</w:tblBorders>`
  );
  if (o.layout) pr.push(`<w:tblLayout w:type="${o.layout}"/>`);
  pr.push(
    '<w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="80" w:type="dxa"/>' +
      '<w:bottom w:w="50" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar>'
  );
  return `<w:tbl><w:tblPr>${pr.join('')}</w:tblPr><w:tblGrid>${cols
    .map((c) => `<w:gridCol w:w="${c}"/>`)
    .join('')}</w:tblGrid>${rows.join('')}</w:tbl>`;
}

/* ================================================================== *
 * Wireframe vocabulary                                                 *
 *
 * A screen is a stack of blocks; a block is one bordered row of the phone
 * table. Everything is plain paragraphs inside a cell, so it stays editable.
 * ================================================================== */

const GREY = { line: 'C9C9C9', bar: 'D9D9D9', soft: 'EFEFEF', box: 'F7F7F7' };
const TONE = {
  brand: { line: '0F766E', fill: 'E6F2F0', text: '0F766E' },
  paid: { line: '15803D', fill: 'E8F6EC', text: '15803D' },
  partial: { line: 'B45309', fill: 'FDF3E3', text: 'B45309' },
  overdue: { line: 'B91C1C', fill: 'FDECEC', text: 'B91C1C' },
  neutral: { line: 'BFBFBF', fill: 'F2F2F2', text: '5A5A5A' },
};

/** A grey placeholder bar. `u` is width in 1/20ths of the phone width. */
  // Return run fragments only. `p()` is responsible for wrapping them in a
  // paragraph; nesting `p()` inside `p()` produces invalid OOXML.
  const bar = (u, o = {}) =>
    r(NB.repeat(Math.max(1, Math.round(u * 2.4))), {
      font: MONO,
      sz: 12,
      shd: o.fill || GREY.bar,
    });

const label = (s) => p(r(s, { sz: 12, caps: 1, color: '7A7A7A', b: 1 }), { sp: { a: 40 } });

/** A status pill: real text on a tinted fill inside a bordered run. */
const pill = (s, tone = 'neutral') => {
  const t = TONE[tone];
  return r(` ${s} `, { sz: 12, b: 1, caps: 1, color: t.text, shd: t.fill, bdr: t.line });
};

/** Placeholder text sitting inside an input box. */
const field = (l, value, o = {}) =>
  p(r(l, { sz: 14, b: 1 }), { sp: { a: 20 } }) +
  p(r(value, { sz: 14, color: value ? '3A3A3A' : '9A9A9A', shd: value ? null : GREY.soft }), {
    sp: { a: 80, l: 240 },
    bottom: GREY.line,
    bottomSz: 4,
  }) +
  (o.hint ? p(r(o.hint, { sz: 12, color: '8A8A8A', i: 1 }), { sp: { a: 80 } }) : p('', { sp: { a: 40 } }));

/** A button, drawn as centred text inside a bordered run. */
const button = (s, variant = 'secondary') => {
  const map = {
    primary: { line: '3A3A3A', fill: '3A3A3A', text: 'FFFFFF' },
    secondary: { line: GREY.line, fill: 'FFFFFF', text: '3A3A3A' },
    destructive: { line: 'C98A8A', fill: 'FDECEC', text: 'B91C1C' },
    link: { line: null, fill: null, text: '0F766E' },
  }[variant];
  return p(r(`  ${s}  `, { sz: 14, b: 1, color: map.text, shd: map.fill, bdr: map.line || undefined }), {
    align: variant === 'link' ? 'left' : 'center',
    sp: { a: 60 },
  });
};

/** A segmented control / tab strip. `on` is the index of the active item. */
const segmented = (items, on = 0) =>
  p(
    items
      .map((item, i) =>
        r(` ${item} `, {
          sz: 13,
          b: i === on,
          color: i === on ? '0F766E' : '8A8A8A',
          shd: i === on ? 'E6F2F0' : undefined,
        })
      )
      .join(r('  |  ', { sz: 13, color: 'C9C9C9' })),
    { align: 'center', shd: 'FFFFFF', sp: { a: 60 } }
  );

/**
 * A block. `t` picks the shape; the rest is the content. Each returns the
 * paragraphs for one row of the phone table.
 */
function block(b) {
  switch (b.t) {
    case 'nav':
      return [
        p(
          (b.back ? r('‹ ', { sz: 18, color: '8A8A8A' }) : '') +
            (b.kick ? r(b.kick + '\n', { sz: 12, caps: 1, color: '8A8A8A', b: 1 }) : '') +
            r(b.title, { sz: 22, b: 1 }) +
            (b.action
              ? r('\t' + b.action, { sz: 13, b: 1, color: '3A3A3A', shd: GREY.soft, bdr: GREY.line })
              : ''),
          { tab: 4600, shd: 'FFFFFF', sp: { a: 60, l: 200 } }
        ),
      ];

    case 'hero':
      return [
        p(
          (b.greeting ? r(b.greeting + '\n', { sz: 15, color: 'E4E4E4' }) : '') +
            r('LEFT TO PAY\n', { sz: 12, caps: 1, color: 'CFCFCF', b: 1 }) +
            r(b.amount + '\n', { sz: 34, b: 1, color: 'FFFFFF' }) +
            r(b.sub, { sz: 13, color: 'D8D8D8' }),
          { shd: '3A3A3A', sp: { a: 60, l: 200 } }
        ),
        ...(b.stats
          ? [
              p(
                b.stats
                  .map((s) => r(`  ${s.k}\n${s.v}  `, { sz: 13, b: 1, color: s.colour || 'FFFFFF' }))
                  .join(r('     ', { sz: 13 })),
                { shd: '4A4A4A', sp: { a: 40, l: 220 } }
              ),
            ]
          : []),
        ...(b.meter
          ? [
              p(r(b.meter, { sz: 12, color: 'D8D8D8' }), { shd: '4A4A4A', sp: { a: 40 } }),
              p(r(NB.repeat(Math.round(b.settled * 4.8)), { font: MONO, sz: 12, shd: 'FFFFFF' }), {
                shd: '6A6A6A',
                sp: { a: 40, l: 200 },
              }),
            ]
          : []),
        ...(b.callout
          ? [
              p(
                r(b.callout.k + '\n', { sz: 12, caps: 1, color: 'CFCFCF', b: 1 }) +
                  r(b.callout.v + '\n', { sz: 20, b: 1, color: b.callout.colour || 'FFFFFF' }) +
                  r(b.callout.note, { sz: 12, color: 'E4E4E4' }),
                { shd: '4A4A4A', sp: { a: 60, l: 200 } }
              ),
            ]
          : []),
      ];

    case 'card':
      return [
        ...(b.title ? [p(b.title, { sp: { a: 60 } })] : []),
        ...(b.pills ? [p(b.pills.map((x) => pill(x[0], x[1])).join('  '), { sp: { a: 60 } })] : []),
        ...(b.text ? [p(b.text, { sz: 14, sp: { a: 60, l: 220 } })] : []),
        ...(b.lines
          ? [
              p(b.lines.map(bar).join(r('')), { sp: { a: 20 } }),
            ]
          : []),
        ...(b.rows
          ? [
              p(
                b.rows.map((x, i) => (i ? '<w:br/>' : '') + r(x.join('  '))).join(''),
                { sp: { a: 20 } }
              ),
            ]
          : []),
        ...(b.cta ? [button(b.cta, 'link')] : []),
      ];

    case 'rows':
      return b.items.map((it) =>
        p(
          (it.pill ? pill(it.pill[0], it.pill[1]) : '') +
            r('   ' + it.label + (it.value ? '        ' + it.value : ''), {
              sz: 14,
              b: !!it.pill,
              color: it.colour,
            }),
          { sp: { a: 50, l: 220 } }
        )
      );

    case 'field':
      return [field(b.label, b.value, b)];

    case 'segmented':
      return [segmented(b.items, b.on)];

    case 'button':
      return [button(b.label, b.variant)];

    case 'group':
      return [label(b.label)];

    case 'notice':
      return [
        p(r(b.title + (b.body ? '\n' : ''), { sz: 14, b: 1, color: b.tone === 'brand' ? '0F766E' : undefined }) +
            (b.body ? r(b.body, { sz: 13, color: '5A5A5A' }) : ''), {
          shd: b.tone === 'brand' ? TONE.brand.fill : b.tone === 'amber' ? TONE.partial.fill : GREY.box,
          sp: { a: 60, l: 220 },
        }),
      ];

    case 'note':
      return [p(r('i  ', { sz: 14, color: '0F766E', b: 1 }) + r(b.text, { sz: 13, color: '6A6A6A' }), { sp: { a: 60, l: 220 } })];

    case 'photo':
      return [
        p(r(`        ${b.label || '[ photo ]'}        `, { sz: 12, caps: 1, color: '8A8A8A', b: 1 }), {
          align: 'center',
          shd: GREY.soft,
          sp: { a: 60, l: 400 },
        }),
      ];

    case 'space':
      return [p('', { sp: { a: 0, l: 120 } })];

    case 'tabs':
      return [
        p(
          b.items
            .map((item, i) =>
              r(`  ${i === b.on ? '■' : '□'} ${item}  `, {
                sz: 12,
                b: true,
                color: i === b.on ? '0F766E' : '9A9A9A',
              })
            )
            .join(''),
          { align: 'center', shd: 'FFFFFF', sp: { a: 40 } }
        ),
      ];

    default:
      throw new Error(`unknown block: ${b.t}`);
  }
}

/** Section heading for a screen, used above the two-column table. */
const screenHeading = (n, route, name) =>
  p(r(`${n}   `, { sz: 22, b: 1, color: '0F766E' }) + r(name, { sz: 24, b: 1 }), {
    keep: true,
    sp: { b: 260, a: 30 },
    bottom: '3A3A3A',
    bottomSz: 8,
  }) +
  p(r(route, { sz: 15, font: MONO, color: '6A6A6A', b: 1 }), { keep: true, sp: { a: 60 } }) +
  p(r('', { sz: 4 }), { sp: { a: 20, l: 120 } });

/* ================================================================== *
 * Content                                                              *
 * ================================================================== */

const TABS = ['Home', 'Bills', 'Repairs', 'House', 'Account'];

const SCREENS = [
  {
    n: '01',
    route: '/',
    name: 'Home',
    why: 'Answer "what do I owe, and is my house okay?" in one scroll, without navigating.',
    blocks: [
      { t: 'nav', title: 'SewaSync', action: '●  +' },
      {
        t: 'hero',
        greeting: 'Good morning, Aiman',
        amount: 'RM 41.40',
        sub: 'Sent via SewaSync',
        stats: [
          { k: 'Paid', v: '594.56', colour: 'B8F0D2' },
          { k: 'Due', v: '41.40', colour: 'FDE68A' },
          { k: 'Overdue', v: '0.00', colour: 'FECACA' },
        ],
        meter: '5 bills · RM 3,174.80 this month · 71% settled',
        settled: 0.71,
        callout: {
          k: 'House overdue',
          v: 'RM 850.00',
          colour: 'FECACA',
          note: 'Kavintharan is 6d late on Rent',
        },
      },
      {
        t: 'card',
        title: 'NEEDS ATTENTION',
        pills: [['3', 'overdue']],
        rows: [
          ['(KS)', 'Kavintharan', 'Rent · RM 850.00', 'OVERDUE 6D'],
          ['(AH)', 'Aiman Hakimi', 'Water · RM 11.40', 'DUE IN 3D'],
          ['(AH)', 'Aiman Hakimi', 'Groceries · RM 30.00', 'DUE IN 5D'],
        ],
        cta: 'Bills ›',
      },
      {
        t: 'card',
        title: 'Why RM 41.40?',
        text: 'Every amount here is a share of a bill in the ledger. Tap any row for the working.',
        cta: '▸  See how each share was worked out',
        lines: [18],
      },
      {
        t: 'card',
        title: 'HOUSE PULSE',
        rows: [
          ['⚒', 'Open repairs', '2 open'],
          ['⌂', 'Next rent', 'RM 2,400.00 · Due 9 Sep'],
          ['▤', 'House Pass', 'RM 9.00 a month', '4 OF 4'],
        ],
      },
      { t: 'group', label: 'QUICK ACTIONS' },
      {
        t: 'card',
        rows: [
          ['+', 'Add a bill', '    ⌗', 'Snap meter'],
          ['$', 'Log payment', '    ⚒', 'Report a repair'],
        ],
      },
      { t: 'note', text: 'SewaSync does not move money. It records that you did.' },
      { t: 'tabs', items: TABS, on: 0 },
    ],
    notes: [
      ['Custom top bar.', 'Logo plus bell and plus buttons. The only tab that does not open with a page header.'],
      ['House-wide, not self-only.', 'The overdue callout names a housemate and links to their bill. Reading your own zero and concluding the house is fine is the trap this avoids.'],
      ['"Why RM 41.40?" collapses by default.', 'Tapping expands the derivation for the soonest-due unpaid share. This is the product’s central claim, so it sits above the fold.'],
      ['Red dot on the Home tab only.', 'It signals unread reminders, and Home is where those land.'],
    ],
  },

  {
    n: '02',
    route: '/bills/',
    name: 'Bills',
    why: 'Scan and filter the ledger. Every card carries three figures: house status, your share, your outstanding.',
    blocks: [
      { t: 'nav', title: 'Bills', action: '+' },
      { t: 'segmented', items: ['All', 'Utilities', 'Rent', 'Other'], on: 0 },
      {
        t: 'card',
        text: '5 bills · RM 3,174.80 this month · 71% settled\nYour share RM 41.40',
      },
      {
        t: 'card',
        title: 'Rent',
        pills: [
          ['Overdue 6d', 'overdue'],
          ['Fixed amount', 'neutral'],
        ],
        text: 'YOUR SHARE RM 450.00\nSettled\nHouse progress ▓▓▓▓▓▓░░░░ 65%',
      },
      {
        t: 'card',
        title: 'Electricity · TNB',
        pills: [
          ['Paid', 'paid'],
          ['⚡ Sub-meter usage', 'brand'],
        ],
        text: 'YOUR SHARE RM 95.46\nSettled\nHouse progress ▓▓▓▓▓▓▓▓▓▓ 100%',
      },
      {
        t: 'card',
        title: 'Wi-Fi · Unifi',
        pills: [
          ['Paid', 'paid'],
          ['Equal split', 'neutral'],
        ],
        text: 'YOUR SHARE RM 32.50\nSettled\nHouse progress ▓▓▓▓▓▓▓▓▓▓ 100%',
      },
      {
        t: 'card',
        title: 'Water · Air Selangor',
        pills: [
          ['Part-paid', 'partial'],
          ['Equal split', 'neutral'],
        ],
        text: 'YOUR SHARE RM 11.40\nDue 18 Sep 2026\nHouse progress ▓▓▓▓▓░░░░░ 50%',
      },
      {
        t: 'card',
        title: 'Groceries',
        pills: [
          ['Part-paid', 'partial'],
          ['Equal split', 'neutral'],
        ],
        text: 'YOUR SHARE RM 46.60\nRM 16.60 of RM 46.60\nHouse progress ▓▓▓▓▓▓▓░░░ 68%',
      },
      { t: 'tabs', items: TABS, on: 1 },
    ],
    notes: [
      ['The progress bar is the house’s settled ratio, not yours.', 'It sits below your share on purpose: your number is the one in bold.'],
      ['The right-hand amount goes blank when your share is settled.', 'The status line under the share label carries the state instead.'],
      ['The split method is spelled out on every card.', '"Sub-meter usage", "Fixed amount" — never a surprise discovered on the detail screen.'],
      ['A draft notice appears above the list', 'if you are holding unsent bills, stating that drafts stay out of every total.'],
    ],
  },

  {
    n: '03',
    route: '/repairs/',
    name: 'Repairs',
    why: 'Tickets grouped open-then-resolved. The card expands in place, so acknowledging never costs a navigation.',
    blocks: [
      { t: 'nav', kick: 'Rumah Kalantan 2', title: 'Repairs', action: '+ Report' },
      { t: 'group', label: '2 OPEN' },
      {
        t: 'card',
        title: '[photo]  Window latch will not lock',
        pills: [['Acknowledged', 'partial']],
        text: 'Structural · Bilik 3\nReported 10 Sep 2026 by Wong\n▸  Activity',
      },
      {
        t: 'card',
        title: '[photo]  Water heater not getting hot',
        pills: [['Reported', 'overdue']],
        text: 'Appliance · Bilik 1\nReported 14 Sep 2026 by Nurul\n▾  Activity',
        rows: [['●', 'Reported · Nurul', '14 Sep 2026']],
      },
      { t: 'group', label: 'RESOLVED (1)' },
      {
        t: 'card',
        title: '[photo]  Air-con leaking in Bilik 2',
        pills: [['Resolved', 'paid']],
        text: 'Air-con · Bilik 2\nReported 3 Sep 2026 by Aiman\n▸  Activity',
      },
      {
        t: 'card',
        title: 'Encik Rahmat moves this forward',
        text: 'once a contractor is booked.',
        cta: 'Only the landlord can mark a repair resolved.',
      },
      { t: 'tabs', items: TABS, on: 2 },
    ],
    notes: [
      ['The header uses a full button, not an icon.', '"Report a repair" is a primary act on this tab, unlike Bills which uses a compact "+".'],
      ['Pill colour is the whole status system.', 'Red reported, amber acknowledged, teal in progress, green resolved.'],
      ['One ticket can be expanded at a time.', 'The disclosure is inline state, not a route.'],
      ['Action buttons are conditional.', '"Acknowledge" only on someone else’s still-reported ticket; "Start work" once acknowledged. Your own report gets a note instead, never a button.'],
    ],
  },

  {
    n: '04',
    route: '/house/',
    name: 'House',
    why: 'Administer rooms, meters, people and house settings; read the activity log.',
    blocks: [
      { t: 'nav', kick: 'Rumah Kalantan 2', title: 'House', action: '+ Invite' },
      {
        t: 'card',
        title: 'Rumah Kalantan 2',
        pills: [['4 people', 'brand']],
        text: 'Jalan Kalantan 2/1, Taman Cyberjaya, Cyberjaya\nTotal usage: 627 kWh',
      },
      { t: 'group', label: 'ROOMS' },
      {
        t: 'rows',
        items: [
          { label: 'Bilik 1', value: 'RM 900.00/month · Meter 1842 → 2110 · 268 kWh', pill: ['2 people', 'neutral'] },
          { label: 'Bilik 2', value: 'RM 850.00/month · Meter 1205 → 1399 · 194 kWh', pill: ['1 people', 'neutral'] },
          { label: 'Bilik 3', value: 'RM 650.00/month · Meter 968 → 1089 · 121 kWh', pill: ['1 people', 'neutral'] },
          { label: '⚡ Common area', value: 'Meter 630 → 674' },
        ],
      },
      { t: 'group', label: 'MEMBERS' },
      {
        t: 'rows',
        items: [
          { label: '(AH) Aiman Hakimi', value: 'RM 41.40   Balance', pill: ['You', 'brand'] },
          { label: '(NI) Nurul Izzati', value: 'RM 0.00   Balance' },
          { label: '(KS) Kavintharan S.', value: 'RM 850.00   Balance' },
          { label: '(WY) Wong Ye Zu', value: 'RM 0.00   Balance' },
        ],
      },
      { t: 'group', label: 'HOUSE ACTIVITY' },
      {
        t: 'rows',
        items: [
          { label: '(AH)', value: 'House Pass reminder queued for 1 Oct' },
          { label: '(NI)', value: 'Nurul reported "Water heater not hot"' },
          { label: '(WY)', value: 'Wong reported "Window latch will not lock"' },
          { label: '(NI)', value: 'Nurul recorded RM 16.60 for Groceries' },
        ],
      },
      { t: 'button', label: 'Show all (6)', variant: 'secondary' },
      {
        t: 'card',
        title: 'LANDLORD ACCESS',
        text: 'Encik Rahmat · Landlord view · read-only\nHe sees rent status and repairs. He never sees how the house splits its electricity.',
        cta: '▸  Preview their view',
      },
      {
        t: 'card',
        title: 'HOUSE SETTINGS',
        text: 'Rent due day       9 · 9 Sep 2026\nReminder cadence   T−3 · T−1 · T−0\nDefault split      Sub-meter usage',
        cta: '▸  Set up your house',
      },
      { t: 'tabs', items: TABS, on: 3 },
    ],
    notes: [
      ['Read-only by default.', 'Only rooms and members carry an action; everything below them is display.'],
      ['Every room card shows rent, both readings and the derived kWh delta.', 'These are the inputs driving every utility share, visible without opening anything.'],
      ['A backwards reading turns the delta line red', 'and the room is charged RM 0 with an explanation, rather than a negative share.'],
      ['Balance is right-aligned per member,', 'so scanning the column ranks who owes what.'],
      ['"Statement" opens a bottom sheet, not a route.', 'A per-person list of bill shares with a period total.'],
      ['Common area has no Edit.', 'It is metered but not billed, so it renders as a slim informational row instead of a full card.'],
    ],
  },

  {
    n: '05',
    route: '/account/',
    name: 'Account',
    why: 'Profile and preferences, but doubles as the hub that reaches the other surfaces.',
    blocks: [
      { t: 'nav', kick: 'Rumah Kalantan 2', title: 'Account', action: 'Demo' },
      {
        t: 'card',
        title: '(AH)  Aiman Hakimi',
        pills: [['3', 'partial']],
        text: 'Bilik 1 · Owner',
      },
      {
        t: 'card',
        title: 'House Pass                              RM 9.00',
        text: 'RM 9.00 a month for the whole house — about RM 2.25 each.\nRenews 1 Oct 2026',
        cta: 'Renew',
      },
      { t: 'group', label: 'NOTIFICATIONS' },
      {
        t: 'rows',
        items: [
          { label: 'Reminders, and only reminders', value: 'ON' },
          { label: 'Payment methods', value: 'DuitNow · Bank transfer' },
          { label: 'Reminders', value: '3' },
        ],
      },
      { t: 'group', label: 'LANGUAGE' },
      { t: 'segmented', items: ['English', 'Bahasa Malaysia'], on: 0 },
      { t: 'group', label: '' },
      {
        t: 'rows',
        items: [
          { label: 'Help & FAQ' },
          { label: 'WhatsApp support', value: 'Weekdays 9am–6pm' },
          { label: 'Terms & Privacy' },
          { label: 'Demo controls' },
          { label: 'Encik Rahmat · Landlord view', value: 'read-only' },
        ],
      },
      { t: 'notice', title: 'Demo mode', body: 'Demo data lives on this device only.' },
      { t: 'button', label: 'Sign out', variant: 'destructive' },
      { t: 'note', text: 'SewaSync does not move money. It records that you did.' },
      { t: 'tabs', items: TABS, on: 4 },
    ],
    notes: [
      ['One card per preference group, divided rows within.', 'The row, not the card, is the tap target — keeps a twelve-row list scannable.'],
      ['Every row carries an icon.', 'Icon-plus-label is redundant, but it survives translation, and Bahasa Malaysia labels run longer.'],
      ['Language is a two-way toggle, not a select.', 'BM is a real second language, so both options are named rather than showing the current one in a dropdown.'],
      ['The language switch is instant and total.', 'There is no save, because there is no server to save to.'],
      ['"Sign out" clears local storage and re-seeds.', 'The only destructive control on the tab, and the only red button outside bill deletion.'],
      ['House Pass is the only upsell, priced per house, not per person.', 'The copy says "about RM 2.25 each" to defuse the group-cost objection.'],
    ],
  },

  {
    n: '06',
    route: '/bills/new/',
    name: 'Add a bill — 1 of 3 · "Bill"',
    why: 'The wizard shell. Note the header changes: back chevron only on step 1, then Back becomes an explicit button.',
    blocks: [
      { t: 'nav', back: true, kick: 'Step 1 of 3', title: 'Add a bill' },
      { t: 'field', label: 'What kind of bill?', value: 'Electricity · Water · Wi-Fi · Rent · Groceries · Other' },
      { t: 'field', label: 'How much?', value: '0.00' },
      { t: 'field', label: 'Give it a short title · optional', value: '—' },
      { t: 'field', label: 'Period', value: '2026-09' },
      { t: 'field', label: 'Payable to', value: 'Who gets paid' },
      { t: 'field', label: 'Issue date  /  Due date', value: '2026-09-15  /  2026-09-30' },
      {
        t: 'field',
        label: 'Receipt photo',
        value: '[ photo ]',
        hint: 'No receipt attached — add one if the house wants a paper trail.',
      },
      { t: 'button', label: 'Next', variant: 'primary' },
    ],
    notes: [
      ['Category is a 3×2 tile grid, not a dropdown.', 'Six options is the threshold where tapping beats scrolling a picker, and the tiles double as a legend of what the app understands.'],
      ['Next stays disabled until an amount parses.', 'Step-one validation is amount, payee and due date; errors appear under the offending field and clear on the next keystroke.'],
      ['The receipt is genuinely optional here,', 'and the hint says so, so it never blocks the flow.'],
      ['Issue and due date are entered two-up,', 'because paired entry is what makes "due in 3d" computable later.'],
    ],
  },

  {
    n: '07',
    route: '/bills/new/',
    name: 'Add a bill — 2 of 3 · "How to split"',
    why: 'Four radio cards, each with a one-line justification. The chosen method injects its own inputs beneath it.',
    blocks: [
      { t: 'nav', kick: 'Step 2 of 3', title: 'Add a bill', action: '← Back' },
      {
        t: 'card',
        title: 'How should this be split?',
        pills: [['✓ selected', 'brand']],
      },
      { t: 'card', title: '○  sub-meter usage', text: 'Each room has its own sub-meter. Common area shared equally.' },
      { t: 'card', title: '○  usage weight', text: 'No meters, but we know who runs the air-con. Normalised.' },
      { t: 'card', title: '○  an equal split', text: 'A flat rate, or a room that genuinely shares.' },
      { t: 'card', title: '○  a fixed monthly amount', text: 'Rent-style: fixed per room, split by occupancy.' },
      {
        t: 'card',
        title: 'TOTAL USAGE',
        text: 'Bilik 1        1842 → 2110 (268 kWh)\nBilik 2        1205 → 1399 (194 kWh)\nBilik 3         968 → 1089 (121 kWh)\nCommon area     630 →  674 ( 44 kWh)',
      },
      { t: 'segmented', items: ['Send to 4 members', 'Draft'], on: 0 },
      {
        t: 'notice',
        title: 'Split and sent to 4 members',
        body: 'Change the method and every figure below recalculates live. The total always matches the bill exactly.',
      },
      { t: 'button', label: '← Back          Next →', variant: 'primary' },
    ],
    notes: [
      ['Each method carries its own defence line.', 'Sub-meter explains common-area sharing; weight explains who runs the air-con. The justification is present at selection time, so nobody argues about fairness after the money is split.'],
      ['Sub-meter shows the readings it will use.', 'Every room’s prev → curr and the delta, so a typo is caught before it becomes someone’s share.'],
      ['The other methods swap this card out for their own inputs.', 'Weight becomes a −/+ stepper per person, fixed becomes an amount field per room, equal needs no input at all.'],
      ['Send vs draft is a segmented control, not a checkbox.', 'The notice beneath restates the consequence: a draft is visible only to you and stays out of every total.'],
    ],
  },

  {
    n: '08',
    route: '/bills/new/',
    name: 'Add a bill — 3 of 3 · "Review and send"',
    why: 'The allocation preview as a table. The last chance to see a number you disagree with before four people receive it.',
    blocks: [
      { t: 'nav', kick: 'Step 3 of 3', title: 'Add a bill', action: '← Back' },
      {
        t: 'card',
        title: 'Electricity · Sep 2026                     RM 412.80',
        pills: [
          ['Sub-meter usage', 'brand'],
          ['Sep 2026', 'neutral'],
        ],
        text: 'Payable to Tenaga Nasional Berhad · Due 30 Sep 2026',
      },
      {
        t: 'card',
        title: 'PREVIEW',
        text: 'Aiman Hakimi         268 kWh      RM 95.46\nNurul Izzati        268 kWh      RM 95.46\nKavintharan S.      194 kWh      RM 134.97\nWong Ye Zu          121 kWh      RM 86.91\n─────────────────────────────────────────────\nShare of bill                    RM 412.80',
      },
      {
        t: 'notice',
        tone: 'brand',
        title: 'Reminder preview',
        body: '"Hi Kavintharan, your Electricity · Sep 2026 share of RM 134.97 for Sep 2026 is due. Tap to record your payment."',
      },
      { t: 'field', label: 'Note for the house · optional', value: '—' },
      { t: 'notice', tone: 'amber', title: 'No usage recorded this period — split equally.' },
      { t: 'button', label: 'Split and send', variant: 'primary' },
      { t: 'button', label: '← Back', variant: 'secondary' },
      { t: 'note', text: 'SewaSync does not move money. It records that you did.' },
    ],
    notes: [
      ['The preview recomputes live', 'against the real allocation engine, not a client-side approximation, so the number you approve is the number that lands.'],
      ['Each row shows kWh next to ringgit', 'when the method is metered, so the reasoning and the result sit on one line.'],
      ['The total row is emphasised,', 'and the engine guarantees the parts sum to the bill exactly. Any leftover sen is adjusted onto the largest share and disclosed later.'],
      ['The reminder preview quotes the whole sentence verbatim,', 'addressed to the largest share. Wording is a fixed template with only the amount varying, so the tone cannot drift per house.'],
      ['Warnings appear here, not after send.', 'They are specific: a room with no usage, a backwards reading, a fixed total that does not match the bill.'],
    ],
  },

  {
    n: '09',
    route: '/bills/view/?id=b-tnb   (also /bills/b-tnb/)',
    name: 'Bill detail',
    why: 'The screen that has to win an argument. Total, then your share with the maths, then everyone else’s, then what was paid.',
    blocks: [
      { t: 'nav', back: true, kick: 'Electricity', title: 'Electricity · TNB' },
      {
        t: 'card',
        title: 'AUG 2026                                          RM 412.80',
        pills: [['Paid', 'paid']],
        text: 'Payable to Tenaga Nasional Berhad · Due 10 Sep 2026',
        cta: 'Fairest · Sub-meter usage · 627 kWh used',
      },
      { t: 'notice', tone: 'amber', title: '⚠ Allocation warning appears here, above your share.' },
      {
        t: 'card',
        title: 'YOUR SHARE RM 95.46',
        pills: [['Paid', 'paid']],
        text: 'You’re charged RM 7.74 less than an equal split. See how we worked it out.\nEach room has its own sub-meter, so the charge lands where the usage happened.',
        rows: [
          ['HOW THIS WAS CALCULATED — For Aiman Hakimi', ''],
          ['Bilik 1 sub-meter', '268 ÷ 627   42.7%'],
          ['Common area share', '44 kWh ÷ 4   RM 7.24'],
          ['Rounding adjustment', '+ RM 0.01'],
          ['Your charge', 'RM 95.46'],
        ],
        cta: 'RM 7.74 less than an equal split',
      },
      { t: 'segmented', items: ['Usage based', 'Equal split'], on: 0 },
      { t: 'segmented', items: ['Breakdown', 'Paid'], on: 0 },
      {
        t: 'card',
        title: 'HOW THIS BILL IS SPLIT',
        cta: '▸  Change method',
        text: 'Each room has its own sub-meter, so the charge lands where the usage happened.',
      },
      {
        t: 'rows',
        items: [
          { label: '(AH) Aiman Hakimi', value: 'Bilik 1 · 268 kWh   RM 95.46', pill: ['Paid', 'paid'] },
          { label: '(NI) Nurul Izzati', value: 'Bilik 1 · 268 kWh   RM 95.46', pill: ['Paid', 'paid'] },
          { label: '(KS) Kavintharan S.', value: 'Bilik 2 · 194 kWh   RM 134.97', pill: ['Paid', 'paid'] },
          { label: '(WY) Wong Ye Zu', value: 'Bilik 3 · 121 kWh   RM 86.91', pill: ['Paid', 'paid'] },
        ],
      },
      {
        t: 'card',
        title: 'Share of bill · Total usage             RM 412.80',
        text: 'Rounding: RM 0.02 was adjusted onto the largest shares so the total matches Tenaga Nasional Berhad exactly.',
      },
      { t: 'button', label: 'Void bill', variant: 'destructive' },
      { t: 'note', text: 'SewaSync does not move money. It records that you did.' },
    ],
    notes: [
      ['Compare-against-equal is the persuasion device.', 'The notice quantifies the difference and the toggle swaps the derivation to equal-split maths, so the claim is checkable rather than asserted.'],
      ['The derivation is generated by the same engine that produced the share,', 'so the explanation cannot drift out of sync with the number.'],
      ['The warning strip sits directly under the header, above your share.', 'It cannot be scrolled past — a backwards meter or an assumed share must be seen before the figure is trusted.'],
      ['"Change method" recalculates every figure live', 'behind a bottom sheet. Reallocation is cheap and reversible in the demo, so the argument can be had before anyone is paid.'],
      ['Per-member rows expand to reveal that person’s derivation,', 'plus a "Remind" action if they still owe. Reminders are logged, never transmitted.'],
      ['"Record payment" only appears when you owe something.', 'On a settled bill the primary action is absent and only Void remains, so the destructive control is never the default.'],
    ],
  },

  {
    n: '10',
    route: '/bills/pay/?id=b-water',
    name: 'Record a payment',
    why: 'One screen, four fields, no wizard. The "who paid" select is what makes it usable by one housemate on another’s behalf.',
    blocks: [
      { t: 'nav', back: true, title: 'Record a payment' },
      { t: 'notice', tone: 'brand', title: 'SewaSync does not move money. This records that the money moved.' },
      {
        t: 'card',
        title: 'BILL',
        pills: [['Unpaid', 'neutral']],
        text: 'Water · Air Selangor\nFull share is RM 11.40\nRM 11.40 still outstanding',
      },
      { t: 'field', label: 'Who paid', value: 'Aiman Hakimi (You)' },
      { t: 'field', label: 'Amount paid', value: '11.40        [ Mark all paid ]', hint: 'Full share is RM 11.40' },
      {
        t: 'field',
        label: 'How',
        value: '✓ DuitNow    Bank transfer    Cash    Household fund',
      },
      { t: 'notice', tone: 'amber', title: 'Part payment — the bill stays Part-paid until the full share is recorded.' },
      { t: 'button', label: 'Record payment', variant: 'primary' },
      { t: 'note', text: 'SewaSync does not move money. It records that you did.' },
    ],
    notes: [
      ['The lead notice repeats the custody disclaimer', 'at the exact moment someone is about to record money that moved. This is the only place the disclaimer is a headline rather than a footnote.'],
      ['"Who paid" is a member list, not just you.', 'A shared house needs to record that someone else handed over cash, and the recorder is tracked separately from the payer.'],
      ['Amount is prefilled to the outstanding share,', 'so the common case is one tap. "Mark all paid" is the explicit shortcut for the same thing.'],
      ['Partial payments are a first-class state.', 'Entering less than the share warns in place and the pill updates, rather than rejecting the input.'],
      ['Entering more than the outstanding share is a hard error.', 'Overpayment is not silently clamped, because a mistyped figure there would misstate the ledger.'],
    ],
  },

  {
    n: '11',
    route: '/repairs/new/',
    name: 'Report a repair',
    why: 'A single-column form. Shorter than Add a bill because there is nothing to calculate — but it has the app’s only hard validation gate.',
    blocks: [
      { t: 'nav', back: true, title: 'New repair request' },
      { t: 'notice', tone: 'brand', title: 'A photo is required.', body: 'Repairs go up with a picture of the problem — add one to send this.' },
      { t: 'field', label: 'What is broken?', value: 'Air-con leaking in Bilik 2' },
      { t: 'field', label: 'Describe it', value: 'What happened, and since when?' },
      { t: 'field', label: 'Category', value: 'Air-con' },
      { t: 'field', label: 'Which room?', value: 'Bilik 1' },
      { t: 'field', label: 'Photo', value: '[ photo ]' },
      { t: 'button', label: 'Send request', variant: 'primary' },
      { t: 'note', text: 'Encik Rahmat moves this forward once a contractor is booked.' },
    ],
    notes: [
      ['The photo requirement is announced up front, not as a surprise error.', 'A brand-toned notice at the top states the rule before the user fills in five other fields.'],
      ['Submit is never disabled.', 'The button stays live, and pressing it without a photo surfaces the requirement — the notice is repeated at the point of failure as well as at the top.'],
      ['Category and room are selects here, not tiles.', 'The photo is the tall element, and selects keep it reachable above the fold on a 390px screen.'],
      ['The camera input accepts image/* with capture enabled,', 'so on a phone this opens the camera directly rather than a file browser.'],
      ['Category drives the placeholder image', 'on the photo stub, so the form previews itself before you shoot anything.'],
      ['Description falls back to the title', 'if left empty — a ticket with a title and photo is accepted rather than blocked on prose.'],
    ],
  },

  {
    n: '12',
    route: '/repairs/t-window/   (also t-aircon, t-heater)',
    name: 'Repair detail',
    why: 'Deep-linkable, statically prerendered. Photo first, then timeline, then the single next action available to you.',
    blocks: [
      { t: 'nav', back: true, kick: 'Activity', title: 'Window latch will not lock' },
      {
        t: 'card',
        title: '[ photo — 4:3 ]',
        pills: [['Acknowledged', 'partial']],
        text: 'Window latch will not lock\nStructural · Bilik 3\nReported 10 Sep 2026 by Wong\nThe latch spins without catching, so the window does not lock.',
      },
      { t: 'group', label: 'ACTIVITY' },
      {
        t: 'rows',
        items: [
          { label: '●  Acknowledged · Encik Rahmat', value: '11 Sep 2026 · Handyman coming next week.' },
          { label: '●  Reported · Wong Ye Zu', value: '10 Sep 2026' },
        ],
      },
      { t: 'group', label: 'CHANGE STATUS' },
      { t: 'button', label: 'Start work', variant: 'secondary' },
      {
        t: 'notice',
        title: 'Encik Rahmat moves this forward once a contractor is booked.',
        body: 'Only the landlord can mark a repair resolved.',
      },
    ],
    notes: [
      ['The photo is full-width and first.', 'On a repair ticket the image is the payload; the text is metadata about it.'],
      ['Timeline entries carry an actor and an optional note,', 'so "Handyman coming next week" survives as context rather than being flattened into a status change.'],
      ['Exactly one action button renders,', 'chosen from the current status and whether you reported it: Acknowledge → Start work → (landlord) Resolve. Never two at once.'],
      ['Your own report gets a note where others get a button,', 'so the screen never invites you to advance a ticket the app already attributes to you.'],
      ['The read-only rule is stated, not enforced silently.', 'Resolving is simply not offered, and the trailing notice says who can.'],
      ['Every entry point deep-links.', 't-aircon, t-heater and t-window are prerendered at build time, so a link shared into a chat resolves with no server.'],
    ],
  },
];

/* ================================================================== *
 * Assembly                                                             *
 * ================================================================== */

const PAGE_W = 15398; // A4 landscape less 720twip margins each side
const PHONE_W = 5200;
const NOTE_W = PAGE_W - PHONE_W - 300;

function bullets(list, sz = 15) {
  return list
    .map(
      ([head, tail]) =>
        p(
          r('•  ', { sz, color: '0F766E', b: 1 }) + r(head + ' ', { sz, b: 1 }) + r(tail, { sz, color: '4A4A4A' }),
          { sp: { a: 90, l: 230 }, ind: 200, hanging: 200 }
        )
    )
    .join('');
}

/** Two columns: the wireframe on the left, annotations on the right. */
function screenRow(screen) {
  // The phone is ONE table with one row per block. `w:tr` elements are only
  // legal inside `w:tbl`, so the rows are collected into a single array rather
  // than concatenated as loose markup.
  const rows = [
    tr([
      tc(block(screen.blocks[0]), {
        w: PHONE_W - 300,
        shd: 'FFFFFF',
        borders: border('bottom', '3A3A3A', 8),
        vAlign: 'center',
      }),
    ]),
    ...screen.blocks.slice(1).map((b) =>
      tr([
        tc(block(b), {
          w: PHONE_W - 300,
          shd: b.t === 'hero' ? '3A3A3A' : b.t === 'tabs' ? 'FFFFFF' : 'FAFAFA',
          borders: border('bottom', 'DDDDDD', 4),
        }),
      ])
    ),
    tr([
      tc([p('', { sp: { a: 0, l: 60 } })], {
        w: PHONE_W - 300,
        shd: 'FFFFFF',
        borders: border('bottom', '3A3A3A', 8),
      }),
    ]),
  ];

  const phoneTable = tbl(rows, {
    cols: [PHONE_W - 300],
    borders: '3A3A3A',
    bordersSz: 12,
  });

  const right = tc(
    [
      p(r(screen.why, { sz: 15, color: '4A4A4A', i: 1 }), { sp: { a: 120, l: 240 } }),
      bullets(screen.notes),
    ],
    { w: NOTE_W, vAlign: 'top' }
  );

  return tbl([tr([tc(phoneTable, { w: PHONE_W, vAlign: 'top' }), right])], {
    cols: [PHONE_W, NOTE_W],
    width: PAGE_W,
    layout: 'fixed',
  });
}

function sectionHead(text) {
  return p(r(text, { sz: 17, caps: 1, b: 1, color: '3A3A3A' }), {
    keep: true,
    sp: { b: 400, a: 120 },
    bottom: '3A3A3A',
    bottomSz: 12,
  });
}

/** A plain data table — used for the index and the invariants list. */
function dataTable(head, rows, widths) {
  const headRow = tr(
    head.map((h, i) =>
      tc([p(r(h, { sz: 14, caps: 1, b: 1, color: '6A6A6A' }), { sp: { a: 20 } })], {
        w: widths[i],
        shd: 'F2F2F2',
        borders: border('bottom', 'AAAAAA', 8),
      })
    )
  );
  const body = rows.map((cells, ri) =>
    tr(
      cells.map((cell, i) =>
        tc([p(r(cell, { sz: 14, b: i === 0 }), { sp: { a: 40, l: 230 } })], {
          w: widths[i],
          shd: ri % 2 ? 'FAFAFA' : undefined,
          borders: border('bottom', 'DDDDDD', 4),
        })
      )
    )
  );
  return tbl([headRow, ...body], { cols: widths, width: widths.reduce((a, b) => a + b, 0) });
}

const INDEX_ROWS = SCREENS.map((s) => [s.n, s.route.split(' ')[0], s.name, s.why]);

const INVARIANTS = [
  [
    'Every money figure is tabular and every amount is integer sen formatted as RM 0.00. No floats, ever.',
    'All 12 screens',
  ],
  [
    'Teal is the only decorative colour. Green, amber and red mean paid / part-paid / overdue and appear nowhere as decoration.',
    'All 12 screens',
  ],
  [
    'Every status is a pill with a word, never colour alone — colour-blind-safe by construction.',
    'Bills, Bill detail, Pay, Repairs, Repair detail, House',
  ],
  [
    'The custody disclaimer ("does not move money, records that you did") appears on every surface where a payment is recorded or contemplated.',
    'Home, Account, Bill detail, Pay, Add bill 3, statement sheet',
  ],
  [
    'Any figure a person may dispute is one tap from its derivation, and the derivation is produced by the same engine as the figure.',
    'Home, Bill detail, Add bill 3, statement sheet',
  ],
  [
    'Reminders are fixed wording with only the amount varying, and are logged rather than transmitted.',
    'Add bill 3, Reminders',
  ],
  [
    'Destructive actions are red, outlined, and never the default primary. A bill with recorded payments offers Void, never Delete, so history survives.',
    'Account, Bill detail',
  ],
  [
    'The bottom tab bar appears on the five primary destinations only, and is hidden on wizard and detail screens where it would compete with the primary action.',
    'Absent on screens 06–12',
  ],
  [
    'Touch targets are 44px minimum; dense rows use the divider list rather than shrinking the target.',
    'All 12 screens',
  ],
  [
    'All copy resolves through the string table in lib/i18n.ts, so English and Bahasa Malaysia are structurally guaranteed to stay in step.',
    'All 12 screens',
  ],
];

const OVERLAYS = [
  ['Room details', 'House → any room → Edit', 'Rent field, a sub-meter on/off switch, and both reading fields. Turning the meter off hides the readings and shows the assumption notice. A current reading below the previous one raises an inline amber warning as you type.'],
  ['{Name}’s statement', 'House → any member → Statement', 'A per-person period list of shares with their state, then a total. Its purpose is to make a figure arguable, so it lists shares, not just a balance.'],
  ['Change method', 'Bill detail → Change method', 'The same four cards in the same order as step 2 of the wizard — a control that appears in two places must look identical in both.'],
  ['Toast', 'Any mutation', 'Repeats the amount and the subject so the confirmation is legible without re-reading the form. Dark pill, teal tick, auto-dismisses at 2.6s.'],
  ['Offline strip', 'navigator.onLine === false', 'Honest copy: it says data is stale rather than implying a sync is pending, because there is no server to retry.'],
  ['Empty state', 'All five tabs', 'One pattern: icon, headline, one sentence of explanation, one action. A filter matching nothing is a different message from an empty ledger.'],
];

const body = [
  // ---- cover
  p(r('SewaSync', { sz: 48, b: 1 }), { sp: { a: 40 } }),
  p(r('Wireframes', { sz: 30, color: '0F766E', b: 1 }), { sp: { a: 200 } }),
  p(
    r(
      'Low-fidelity layout specification for the core five tabs and their key flows. Every screen is traced from the shipped implementation in components/*Screen.tsx, so section order and control types reflect what actually ships. Grey bars stand in for imagery and copy weight; annotations carry the behaviour that is not obvious from the box drawing.',
      { sz: 17, color: '4A4A4A' }
    ),
    { sp: { a: 200, l: 280 } }
  ),
  dataTable(
    ['', ''],
    [
      ['Stack', 'Next.js 15 App Router · React 19 · Tailwind 3.4 · Plus Jakarta Sans'],
      ['Target', '390 × 844, mobile-first, phone-framed'],
      ['Navigation', 'Five-tab bottom bar. No desktop chrome.'],
      ['Demo fixture', 'Rumah Kalantan 2 · Aiman Hakimi · pinned to 15 Sep 2026, 09:41'],
      ['Companion file', 'docs/wireframes.html — the richer edition; this file is the Word-portable one'],
    ],
    [2600, PAGE_W - 2600]
  ),
  p(
    r(
      'Note on this document: these are wireframes, not mockups. They fix layout, hierarchy and interaction, and deliberately carry no brand colour, imagery or finished type. Every block on every screen is a table cell, so you can retype a label, retint a row or move a block without touching markup. Amounts are the real seeded figures, so the arithmetic agrees across all screens — RM 412.80 of TNB splits to 95.46 / 95.46 / 134.97 / 86.91, and Aiman owes RM 41.40 across two bills.',
      { sz: 15, color: '6A6A6A', i: 1 }
    ),
    { sp: { b: 200, l: 260 } }
  ),

  // ---- index
  sectionHead('1 — Screen index'),
  dataTable(['#', 'Route', 'Screen', 'Job to be done'], INDEX_ROWS, [520, 2900, 3400, PAGE_W - 520 - 2900 - 3400]),
  p(
    r(
      'Not drawn here, but part of the product: /reminders/, /landlord/, /setup/, /setup/invite/, /snap/, /demo/. Bill detail and repair detail are each statically prerendered at a concrete id, so every link into them works offline — /bills/b-tnb/ and /repairs/t-window/ are both valid URLs.',
      { sz: 14, color: '6A6A6A', i: 1 }
    ),
    { sp: { b: 100, l: 250 } }
  ),

  // ---- flow
  sectionHead('2 — Flow map'),
  p(
    r(
      [
        'The five tabs are always available to each other. Everything else is reached from within a',
        'screen and returns to it.',
        '',
        '   TABS      Home · Bills · Repairs · House · Account        (present on screens 01–05 only)',
        '',
        '   HOME      bell ............................→ /reminders/',
        '            quick action “Add a bill” .......→ /bills/new/        [wizard, 3 steps]',
        '            quick action “Snap meter” .......→ /snap/',
        '            quick action “Log payment” ......→ /bills/',
        '            quick action “Report a repair” ...→ /repairs/new/',
        '            hero / attention / pulse row ....→ /bills/view/?id=…  or /repairs/',
        '',
        '   BILLS     + ...............................→ /bills/new/        [wizard, 3 steps]',
        '            any bill card ....................→ /bills/view/?id=…',
        '',
        '   REPAIRS   + Report a repair ................→ /repairs/new/',
        '            any ticket title .................→ /repairs/{id}/',
        '            landlord card ....................→ /landlord/',
        '',
        '   HOUSE     any room → Edit .................→ Sheet (not a route)',
        '            any member → Statement ...........→ Sheet (not a route)',
        '            landlord card → Preview ..........→ /landlord/',
        '            settings → Set up your house .....→ /setup/',
        '',
        '   ACCOUNT   Reminders row ...................→ /reminders/',
        '            Demo controls row ................→ /demo/',
        '            Landlord view row ................→ /landlord/',
        '            Sign out ..........................→ resets local data',
        '',
        '   BILL DETAIL   Change method ...............→ Sheet (not a route)',
        '                 Record payment ..............→ /bills/pay/?id=…',
        '                 Remind (per member) .........→ logs only, sends nothing',
        '',
        '   SHEETS         room editor · per-member statement · change split method',
        '   TOASTS         recorded · sent · copied · reset · acknowledged',
      ].join('\n'),
      { sz: 14, font: MONO }
    ),
    { shd: 'F7F7F7', sp: { a: 120, l: 230 } }
  ),

  // ---- screens
  sectionHead('3 — Core tabs and key flows'),
  ...SCREENS.flatMap((s) => [screenHeading(s.n, s.route, s.name), screenRow(s)]),

  // ---- overlays
  sectionHead('4 — Overlays and states (not routes)'),
  p(
    r(
      'Three bottom sheets, one toast, one strip and one empty state. They are the app’s only modal surfaces, and all three sheets dismiss on Escape and on backdrop tap, so they are reachable by keyboard as well as thumb.',
      { sz: 15, color: '4A4A4A', i: 1 }
    ),
    { sp: { a: 120, l: 250 } }
  ),
  dataTable(['Overlay', 'Opened from', 'Behaviour'], OVERLAYS, [2600, 3400, PAGE_W - 2600 - 3400]),

  // ---- invariants
  sectionHead('5 — Cross-screen invariants'),
  p(
    r('Each of these is load-bearing for trust rather than for looks.', { sz: 15, color: '4A4A4A', i: 1 }),
    { sp: { a: 120, l: 250 } }
  ),
  dataTable(['Invariant', 'Where it shows'], INVARIANTS, [PAGE_W - 4200, 4200]),
].join('');

const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}"><w:body>${body}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="220" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;

const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>SewaSync — Wireframes</dc:title><dc:description>Low-fidelity layout specification for the core five tabs and key flows.</dc:description><cp:revision>1</cp:revision><dcterms:created xsi:type="dcterms:W3CDTF">2026-09-15T09:41:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2026-09-15T09:41:00Z</dcterms:modified></cp:coreProperties>`;

const app = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>SewaSync build-wireframes-docx</Application></Properties>`;

const buf = zip({
  '[Content_Types].xml': contentTypes,
  '_rels/.rels': rootRels,
  'docProps/core.xml': core,
  'docProps/app.xml': app,
  'word/_rels/document.xml.rels': docRels,
  'word/document.xml': document,
  'word/styles.xml': styles,
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, buf);

console.log(`wireframes.docx  ${(buf.length / 1024).toFixed(1)} kB  ${SCREENS.length} screens`);