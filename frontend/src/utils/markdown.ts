// Minimal, dependency-free Markdown parser for Atlasync Intelligence answers.
//
// The Forge LLM returns structured Markdown (headings, lists, GFM pipe tables,
// bold/emphasis, inline code, fenced code blocks, links). This parser turns that
// text into a small AST; `Markdown.tsx` renders the AST as React elements.
//
// Security: the parser never treats input as HTML — raw HTML in the answer is
// kept as plain text, and React escapes every text node on render. Links are
// validated by `isSafeLink` (http/https/mailto/relative only); anything else
// (javascript:, data:, vbscript:) degrades to plain text.

export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineNode[] }
  | { type: 'italic'; children: InlineNode[] }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; href: string };

export type TableAlign = 'left' | 'center' | 'right' | null;

export type BlockNode =
  | { type: 'heading'; level: 1 | 2 | 3; children: InlineNode[] }
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'code'; language: string; text: string }
  | { type: 'list'; ordered: boolean; items: InlineNode[][] }
  | { type: 'table'; align: TableAlign[]; header: InlineNode[][]; rows: InlineNode[][][] }
  | { type: 'hr' };

const SAFE_LINK = /^(https?:\/\/|mailto:|\/|#)[^\s]*$/i;

export function isSafeLink(href: string): boolean {
  const trimmed = href.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return false;
  return SAFE_LINK.test(trimmed);
}

function splitTableRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|')) row = row.slice(0, -1);
  const cells: string[] = [];
  let current = '';
  let inCode = false;
  for (let i = 0; i < row.length; i += 1) {
    const ch = row[i];
    if (ch === '`') inCode = !inCode;
    if (ch === '|' && !inCode && row[i - 1] !== '\\') {
      cells.push(current.trim().replace(/\\\|/g, '|'));
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim().replace(/\\\|/g, '|'));
  return cells;
}

function isTableSeparator(line: string): boolean {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{1,}:?$/.test(c));
}

function parseAlign(line: string): TableAlign[] {
  return splitTableRow(line).map((c) => {
    const left = c.startsWith(':');
    const right = c.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return null;
  });
}

/** Parse inline markup (`**bold**`, `*italic*`, `` `code` ``, `[text](url)`). */
export function parseInline(input: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let i = 0;
  const pushText = (text: string) => {
    if (!text) return;
    const last = nodes[nodes.length - 1];
    if (last && last.type === 'text') last.text += text;
    else nodes.push({ type: 'text', text });
  };

  while (i < input.length) {
    // Inline code — take the next closing backtick literally.
    if (input[i] === '`') {
      const end = input.indexOf('`', i + 1);
      if (end > i + 1) {
        nodes.push({ type: 'code', text: input.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
      pushText('`');
      i += 1;
      continue;
    }
    // Link [text](href) — only when the href is safe, else plain text.
    // The href scan balances nested parens, so `alert(1)` inside a
    // javascript: URL does not leak a stray `)` into the text.
    if (input[i] === '[') {
      const closeText = input.indexOf(']', i + 1);
      if (closeText > i + 1 && input[closeText + 1] === '(') {
        let depth = 1;
        let closeHref = -1;
        for (let j = closeText + 2; j < input.length; j += 1) {
          if (input[j] === '(') depth += 1;
          else if (input[j] === ')') {
            depth -= 1;
            if (depth === 0) {
              closeHref = j;
              break;
            }
          }
        }
        if (closeHref > closeText + 2) {
          const href = input.slice(closeText + 2, closeHref);
          const text = input.slice(i + 1, closeText);
          if (isSafeLink(href)) {
            nodes.push({ type: 'link', text, href: href.trim() });
          } else {
            pushText(text);
          }
          i = closeHref + 1;
          continue;
        }
      }
      pushText('[');
      i += 1;
      continue;
    }
    // Bold **...** (checked before italic so `**` wins).
    if (input.startsWith('**', i)) {
      const end = input.indexOf('**', i + 2);
      if (end > i + 2) {
        nodes.push({ type: 'bold', children: parseInline(input.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
      pushText('**');
      i += 2;
      continue;
    }
    // Italic *...* or _..._
    if (input[i] === '*' || input[i] === '_') {
      const marker = input[i];
      const end = input.indexOf(marker, i + 1);
      if (end > i + 1) {
        nodes.push({ type: 'italic', children: parseInline(input.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
      pushText(marker);
      i += 1;
      continue;
    }
    // Plain text up to the next special character.
    const next = (() => {
      const candidates = ['`', '[', '*', '_'].map((c) => input.indexOf(c, i)).filter((n) => n >= 0);
      const bold = input.indexOf('**', i);
      if (bold >= 0) candidates.push(bold);
      return candidates.length ? Math.min(...candidates) : input.length;
    })();
    pushText(input.slice(i, next));
    i = next;
  }
  return nodes;
}

export function parseMarkdown(input: string): BlockNode[] {
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const blocks: BlockNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // Fenced code block.
    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // closing fence (or EOF)
      blocks.push({ type: 'code', language, text: body.join('\n') });
      continue;
    }

    // ATX heading.
    const heading = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(trimmed);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3, children: parseInline(heading[2]) });
      i += 1;
      continue;
    }

    // Horizontal rule.
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    // GFM pipe table: header row followed by a separator row.
    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = splitTableRow(trimmed);
      const align = parseAlign(lines[i + 1]);
      const rows: InlineNode[][][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trim() !== '') {
        rows.push(splitTableRow(lines[i]).map((cell) => parseInline(cell)));
        i += 1;
      }
      blocks.push({ type: 'table', align, header: header.map((cell) => parseInline(cell)), rows });
      continue;
    }

    // Lists: consecutive `- `, `* ` or `1. ` lines of one kind.
    const listMatch = /^([-*]|\d+[.)])\s+/.exec(trimmed);
    if (listMatch) {
      const ordered = /^\d/.test(listMatch[1]);
      const items: InlineNode[][] = [];
      while (i < lines.length) {
        const item = /^([-*]|\d+[.)])\s+(.*)$/.exec(lines[i].trim());
        if (!item) break;
        if (/^\d/.test(item[1]) !== ordered) break;
        items.push(parseInline(item[2]));
        i += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    // Paragraph: consecutive non-blank, non-structural lines, joined with spaces.
    const para: string[] = [trimmed];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !/^(#{1,3})\s+/.test(lines[i].trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !/^([-*]|\d+[.)])\s+/.test(lines[i].trim()) &&
      !(lines[i].trim().includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push({ type: 'paragraph', children: parseInline(para.join(' ')) });
  }

  return blocks;
}
