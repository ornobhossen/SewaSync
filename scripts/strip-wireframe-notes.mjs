/**
 * Strips the route line, the "why" line, and the annotation list from every
 * wireframe in docs/wireframes.html. The screen title (.name) is kept.
 *
 * Regex is not safe here: a naive `<div class="cap">.*?</div>` stops at the
 * first closing tag, which belongs to the .route child, and orphans the rest
 * of the block. So this walks the markup and tracks nesting depth to find the
 * true end of each block.
 *
 *   node scripts/strip-wireframe-notes.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'docs', 'wireframes.html');
const dryRun = process.argv.includes('--dry');

/**
 * Finds the index just past the element that opens at `start`.
 * Scans forward counting nested opens of the same tag name, skipping over
 * attribute values, comments, and self-closing tags.
 */
function findElementEnd(html, start, tag) {
  const open = new RegExp(`<${tag}\\b`, 'gi');
  const close = new RegExp(`</${tag}\\s*>`, 'gi');
  let depth = 0;
  let i = start;

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) return -1;

    // Skip comments and the doctype wholesale.
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html[lt + 1] === '!') {
      const end = html.indexOf('>', lt);
      i = end === -1 ? html.length : end + 1;
      continue;
    }

    close.lastIndex = lt;
    const closeMatch = close.exec(html);
    open.lastIndex = lt;
    const openMatch = open.exec(html);

    // Which comes first?
    if (closeMatch && (!openMatch || closeMatch.index <= openMatch.index)) {
      depth -= 1;
      i = closeMatch.index + closeMatch[0].length;
      if (depth === 0) return i;
      continue;
    }

    // Consume the whole open tag so quoted '>' inside attributes is safe.
    let j = lt + 1;
    let quote = null;
    while (j < html.length) {
      const ch = html[j];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        break;
      }
      j += 1;
    }
    const isSelfClosing = html[j - 1] === '/';
    if (!isSelfClosing) depth += 1;
    i = j + 1;
  }
  return -1;
}

/** Removes every `<tagName ...>...</tagName>` whose open tag has `class="<cls>"`. */
function stripElements(html, tagName, cls) {
  let out = html;
  let removed = 0;

  for (;;) {
    const re = new RegExp(`<${tagName}\\b[^>]*\\bclass="${cls}"[^>]*>`, 'g');
    const m = re.exec(out);
    if (!m) break;

    const end = findElementEnd(out, m.index, tagName);
    if (end === -1) {
      throw new Error(`unbalanced <${tagName}> at offset ${m.index}`);
    }

    // Swallow the newline and leading indent that followed the block.
    let tail = end;
    while (tail < out.length && /[ \t]/.test(out[tail])) tail += 1;
    if (out[tail] === '\r') tail += 1;
    if (out[tail] === '\n') tail += 1;

    out = out.slice(0, m.index) + out.slice(tail);
    removed += 1;
  }
  return { html: out, removed };
}

/** Drops CSS rule blocks whose selector references `class="cls"` or `.cls`. */
function stripCssRules(css, cls) {
  let removed = 0;
  const out = css.replace(/[^{}]+\{[^{}]*\}/g, (rule) => {
    const selector = rule.slice(0, rule.indexOf('{'));
    // Only touch rules that actually target this class.
    if (new RegExp(`\\.${cls}\\b`).test(selector)) {
      removed += 1;
      return '';
    }
    return rule;
  });
  return { css: out, removed };
}

let html = readFileSync(target, 'utf8');
const before = { bytes: html.length };

// Keep the screen title (.name); drop only the route line, the "why" line,
// and the annotation list.
const routes = stripElements(html, 'div', 'route');
html = routes.html;
const whys = stripElements(html, 'div', 'why');
html = whys.html;
const anns = stripElements(html, 'ol', 'ann');
html = anns.html;

// Drop the now-dead CSS. `.cap` and `.name` are retained.
const cssStart = html.indexOf('<style>');
const cssEnd = html.indexOf('</style>');
let css = html.slice(cssStart + 7, cssEnd);
// Thread the accumulator: each pass must strip from the previous pass's
// output, not from the original CSS, or only the last class is removed.
let cssRemoved = 0;
for (const cls of ['route', 'why', 'ann']) {
  const result = stripCssRules(css, cls);
  css = result.css;
  cssRemoved += result.removed;
}
css = css.replace(/\n{3,}/g, '\n\n');
html = html.slice(0, cssStart + 7) + css + html.slice(cssEnd);

// Report
const opens = (html.match(/<div\b/g) || []).length;
const closes = (html.match(/<\/div>/g) || []).length;
const ols = (html.match(/<ol\b/g) || []).length;
const olCloses = (html.match(/<\/ol>/g) || []).length;

console.log(`route lines removed    : ${routes.removed}`);
console.log(`why lines removed      : ${whys.removed}`);
console.log(`annotation lists removed: ${anns.removed}`);
console.log(`css rules removed      : ${cssRemoved}`);
console.log(`bytes                  : ${before.bytes} -> ${html.length}`);
console.log(`div balance            : ${opens} open / ${closes} close`);
console.log(`ol  balance            : ${ols} open / ${olCloses} close`);

if (opens !== closes) {
  throw new Error('div imbalance - refusing to write');
}
if (ols !== olCloses) {
  throw new Error('ol imbalance - refusing to write');
}

if (dryRun) {
  console.log('\n--dry: nothing written');
} else {
  writeFileSync(target, html, 'utf8');
  console.log(`\nwrote ${target}`);
}
