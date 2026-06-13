import { parse, parseFragment } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';

type P5Node = DefaultTreeAdapterMap['node'];
type P5Element = DefaultTreeAdapterMap['element'];

export type AttrKind = 'static' | 'binding' | 'event' | 'structural';

export interface AttrInfo {
  /** Raw attribute name as written, e.g. `[attr.aria-hidden]` */
  raw: string;
  /** Normalized lowercase name, e.g. `aria-hidden` */
  name: string;
  kind: AttrKind;
  value: string;
}

/**
 * Normalize an attribute name, unwrapping Angular template binding syntax:
 *   `[attr.aria-hidden]` / `[aria-label]` / `attr.aria-live` -> binding
 *   `(ngSubmit)` -> event
 *   `*ngFor` -> structural
 */
export function normalizeAttrName(raw: string): { name: string; kind: AttrKind } {
  let n = raw.toLowerCase();
  if (n.startsWith('(') && n.endsWith(')')) {
    return { name: n.slice(1, -1), kind: 'event' };
  }
  if (n.startsWith('*')) {
    return { name: n, kind: 'structural' };
  }
  let kind: AttrKind = 'static';
  if (n.startsWith('[') && n.endsWith(']')) {
    kind = 'binding';
    n = n.slice(1, -1);
  }
  if (n.startsWith('attr.')) {
    n = n.slice(5);
  }
  return { name: n, kind };
}

export class ElementInfo {
  tag: string;
  attrs = new Map<string, AttrInfo[]>();
  events = new Set<string>();
  parent: ElementInfo | null;
  children: ElementInfo[] = [];
  line: number;
  col: number;
  private ownText: string[] = [];

  constructor(tag: string, parent: ElementInfo | null, line: number, col: number) {
    this.tag = tag;
    this.parent = parent;
    this.line = line;
    this.col = col;
  }

  addAttr(raw: string, value: string): void {
    const { name, kind } = normalizeAttrName(raw);
    if (kind === 'event') {
      this.events.add(name);
      return;
    }
    const info: AttrInfo = { raw, name, kind, value };
    const list = this.attrs.get(name);
    if (list) list.push(info);
    else this.attrs.set(name, [info]);
  }

  addText(text: string): void {
    this.ownText.push(text);
  }

  /** True if the attribute is present, statically or as an Angular binding. */
  has(name: string): boolean {
    return this.attrs.has(name.toLowerCase());
  }

  /** True if the attribute is present only as a binding (value unknowable statically). */
  hasBinding(name: string): boolean {
    const list = this.attrs.get(name.toLowerCase());
    return !!list && list.some((a) => a.kind === 'binding');
  }

  /** Static (literal) value of the attribute, if one was written. */
  staticValue(name: string): string | undefined {
    const list = this.attrs.get(name.toLowerCase());
    return list?.find((a) => a.kind === 'static')?.value;
  }

  /** Concatenated text content of this element and its descendants. */
  text(): string {
    let out = this.ownText.join('');
    for (const child of this.children) out += child.text();
    return out;
  }

  *ancestors(): Generator<ElementInfo> {
    let cur = this.parent;
    while (cur) {
      yield cur;
      cur = cur.parent;
    }
  }

  *descendants(): Generator<ElementInfo> {
    for (const child of this.children) {
      yield child;
      yield* child.descendants();
    }
  }
}

function isElement(node: P5Node): node is P5Element {
  return 'tagName' in node;
}

/**
 * Parse an HTML document or Angular component template into a flat,
 * document-ordered list of ElementInfo nodes with parent/child links.
 */
export function parseTemplate(source: string): ElementInfo[] {
  const looksLikeDocument = /<\s*(!doctype|html|head|body)[\s>]/i.test(source);
  const root = looksLikeDocument
    ? parse(source, { sourceCodeLocationInfo: true })
    : parseFragment(source, { sourceCodeLocationInfo: true });

  const all: ElementInfo[] = [];

  const visit = (node: P5Node, parent: ElementInfo | null): void => {
    if (isElement(node)) {
      const loc = node.sourceCodeLocation;
      const el = new ElementInfo(
        node.tagName.toLowerCase(),
        parent,
        loc?.startLine ?? 0,
        loc?.startCol ?? 0,
      );
      for (const attr of node.attrs) el.addAttr(attr.name, attr.value);
      if (parent) parent.children.push(el);
      all.push(el);
      for (const child of node.childNodes) visit(child, el);
      // <template> children live on a separate content fragment
      const content = (node as { content?: { childNodes: P5Node[] } }).content;
      if (content) for (const child of content.childNodes) visit(child, el);
      return;
    }
    if (node.nodeName === '#text' && parent) {
      parent.addText((node as { value: string }).value);
      return;
    }
    if ('childNodes' in node) {
      for (const child of node.childNodes) visit(child, parent);
    }
  };

  visit(root as P5Node, null);
  return all;
}
