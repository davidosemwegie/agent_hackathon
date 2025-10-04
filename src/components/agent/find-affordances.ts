// frontend/affordances.ts

import { z } from "zod";

export const AffordanceSchema = z.object({
  id: z.string(),
  role: z.string().optional(),
  tag: z.string(),
  name: z.string().optional(),
  text: z.string().optional(),
  href: z.string().optional(),
  attrs: z.record(z.string(), z.string()),
  rels: z.object({ forId: z.string().optional() }).optional(),
  bbox: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }),
  visible: z.boolean(),
  enabled: z.boolean(),
  cssPath: z.string(),
  selector: z.string(),
});

export type Affordance = z.infer<typeof AffordanceSchema>;

export function collectAffordances(max = 400): Affordance[] {
  const els = Array.from(
    document.querySelectorAll<HTMLElement>(
      [
        "a,button,[role=button],[role=link],input,textarea,select,[contenteditable=true],\
      [role=tab],[role=menuitem],[role=option],[role=treeitem]",
      ].join(",")
    )
  );

  const DATA_ATTR = "data-umbrellamode-id";
  const seenIds = new Set<string>();

  const hashString = (input: string) => {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0; // force 32-bit integer wrap
    }
    return Math.abs(hash).toString(36);
  };

  const ensureAffordanceId = (el: HTMLElement) => {
    const existing = el.getAttribute(DATA_ATTR);
    if (existing) {
      seenIds.add(existing);
      return existing;
    }

    const base =
      hashString(
        [
          el.tagName,
          el.getAttribute("id") || "",
          el.getAttribute("name") || "",
          el.getAttribute("aria-label") || "",
          (el.textContent || "").slice(0, 64),
          el.className,
        ].join("|")
      ) || (crypto?.randomUUID ? crypto.randomUUID() : `aff-${Date.now()}`);

    let candidate = base;
    let counter = 1;
    while (seenIds.has(candidate)) {
      candidate = `${base}-${counter}`;
      counter += 1;
    }

    el.setAttribute(DATA_ATTR, candidate);
    seenIds.add(candidate);
    return candidate;
  };

  const isVisible = (el: Element) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    const s = getComputedStyle(el as HTMLElement);
    return (
      r.width > 0 &&
      r.height > 0 &&
      s.visibility !== "hidden" &&
      s.display !== "none"
    );
  };

  const accName = (el: HTMLElement) => {
    // very simplified accessible-name resolution
    const aria =
      el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
    if (aria) return aria;
    const lbl = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
    if (lbl?.textContent) return lbl.textContent.trim();
    if (el.tagName === "IMG") return (el as HTMLImageElement).alt || undefined;
    const txt = el.textContent?.trim();
    return txt ? txt : undefined;
  };

  const bestCss = (el: Element): string => {
    // prefer #id (non-hashed), then name/placeholder, then role+nth-of-type
    const id = el.getAttribute("id");
    if (id && !/\b[a-f0-9]{6,}\b/i.test(id)) return `#${CSS.escape(id)}`;
    const name = el.getAttribute("name");
    if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;
    const placeholder = el.getAttribute("placeholder");
    if (placeholder)
      return `${el.tagName.toLowerCase()}[placeholder="${placeholder}"]`;
    // fallback: tag + class piece + nth-of-type in nearest labeled section
    const cls = (el.getAttribute("class") || "")
      .split(/\s+/)
      .find((c) => c.length > 2);
    const parent =
      el.parentElement && el.parentElement.tagName !== "BODY"
        ? `${el.parentElement.tagName.toLowerCase()}`
        : "body";
    const nth =
      Array.from(el.parentElement?.children || [])
        .filter((e) => e.tagName === el.tagName)
        .indexOf(el) + 1;
    return `${parent} ${el.tagName.toLowerCase()}${
      cls ? "." + cls : ""
    }:nth-of-type(${nth})`;
  };

  const hash = (s: string) =>
    crypto?.subtle
      ? ""
      : String(
          Math.abs(
            [...s].reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
          )
        ); // simple sync fallback

  const items: Affordance[] = [];
  for (const el of els) {
    const visible = isVisible(el);
    const enabled = !(el as HTMLInputElement | HTMLButtonElement).disabled;
    const rect = el.getBoundingClientRect();
    const affordanceId = ensureAffordanceId(el);
    const a: Affordance = {
      id: affordanceId,
      role:
        el.getAttribute("role") || (el.tagName === "A" ? "link" : undefined),
      tag: el.tagName,
      name: accName(el),
      text: el.textContent?.trim().slice(0, 140),
      href: (el as HTMLAnchorElement).href,
      attrs: Object.fromEntries(
        [
          "id",
          "name",
          "type",
          "placeholder",
          "value",
          "data-testid",
          "aria-label",
        ]
          .map((k) => [k, el.getAttribute(k) || ""])
          .filter(([, v]) => v)
      ),
      rels: { forId: el.getAttribute("for") || undefined },
      bbox: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      visible,
      enabled,
      cssPath: bestCss(el),
      selector: `[${DATA_ATTR}="${affordanceId}"]`,
    };
    items.push(a);
    if (items.length >= max) break;
  }
  return items;
}
