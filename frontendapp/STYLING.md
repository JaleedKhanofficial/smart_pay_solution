# Styling guide

How the interface is coloured and built, and where to change each thing.

The rule that saves the most time: **colour lives in `src/app/globals.css`, shape
lives in `src/components/ui/`.** Screens should almost never carry a raw colour
class.

---

## 1. Three layers

```
src/app/globals.css      tokens       the colours themselves   → changes the whole app
src/components/ui/       components   Button, Card, Badge      → changes every instance
src/app/**               screens      className overrides      → changes one spot
```

Work in the lowest layer that achieves what you want. Reaching for a screen-level
override usually means a token or a component variant is missing.

---

## 2. Light and dark

Appearance is a **three-way choice** — Light, Dark or System — set from the radio
group in the top bar. The choice is stored in the `sps_mode` cookie and read on
the server in `app/layout.tsx`, which stamps `data-theme` on `<html>` before the
first paint. Reading it on the client instead would flash the wrong appearance on
every load.

`globals.css` therefore has **three** blocks:

| Block | When it applies |
|---|---|
| `:root { … }` | light — the base palette |
| `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` | **System**, when the OS is dark |
| `:root[data-theme="dark"] { … }` | **Dark**, chosen explicitly |

The `:not([data-theme="light"])` is load-bearing: without it, choosing Light
would still be overruled by the media query on a machine set to dark.

**The two dark blocks hold the same values on purpose.** CSS has no include, so
if you change a dark colour you must change it in both places.

This is the most common source of *"my change did nothing"*. Before editing,
work out which block you are actually looking at.

To drop the feature and follow the OS only, delete `:root[data-theme="dark"]`
and the toggle. To force one appearance, keep a single block.

Note that `--gold-ink` is redefined in the dark blocks as `var(--gold-soft)`: a
bright gold is unreadable as text on a light card but perfectly readable on a
dark one, so the token flips automatically.

### Files involved

| File | Role |
|---|---|
| `lib/theme-mode.ts` | cookie name, the three modes, validation — a plain module, because a constant imported by a Server Component must not live in a `"use client"` file |
| `components/theme-mode-toggle.tsx` | the radio group; writes the cookie and the attribute in an effect |
| `app/layout.tsx` | reads the cookie, stamps `data-theme` |

---

## 3. Token map

Everything visible traces back to one of these.

### Application chrome

| Token | Used for |
|---|---|
| `--chrome-900` | sidebar background, top bar background |
| `--chrome-800` | primary button background |
| `--chrome-700` | primary button hover |
| `--chrome-600` | focus border on inputs |

The chrome scale is deliberately near-black and separate from the content
surfaces, so the shell can be dark while records stay on a light background.

### Content surfaces

| Token | Used for |
|---|---|
| `--background` | the page behind the cards |
| `--surface` | cards, tables, the filter panel |
| `--surface-muted` | table header strip, row hover, secondary button hover |
| `--border` | card borders, row dividers, input borders |
| `--foreground` | body text — `#000000` in light, `#e7e7ea` in dark |
| `--muted` | labels, hints, descriptions, `s/o …`, pagination — `#475467` in light, `#9a9aa2` in dark |

`--muted` was originally `#667085`, which passed AA at 4.97:1 but read as washed
out at small sizes. It is now `#475467` (7.69:1 on a card). Secondary text is
mostly 12px, and a bare pass is not enough there.

### Accent and status

| Token | Used for |
|---|---|
| `--gold` | the `S` mark, active nav icon, the active-item bar in the sidebar |
| `--gold-soft` | `SOLUTIONS` wordmark, the role label under the user's name |
| `--gold-ink` | gold used as **text on a light surface** — `PENDING` pills, the active sort arrow |
| `--positive` | success toasts, positive figures |
| `--negative` | Delete buttons, validation errors |

---

## 4. Where each control comes from

| On screen | Component | Variant |
|---|---|---|
| **Add customer**, **Apply**, **Sign in**, **Save changes** | `Button` / `ButtonLink` | `primary` |
| **Filters**, **Edit**, **Cancel**, **Previous** / **Next** | `Button` / `ButtonLink` | `secondary` |
| **Delete** | `Button` | `danger` |
| Icon-only actions in the sidebar | `Button` | `ghost` |
| Cards, table shell, filter panel | `Card` (or `CARD_CLASS`) | — |
| Card titles with a description | `CardHeader` | — |
| Form field grids | `CardFields` | 1 / 2 / 3 columns |
| Form action rows | `CardFooter` | — |
| `PENDING`, filter count, status chips | `Badge` | `accent` `neutral` `positive` `negative` `solid` |
| Text inputs, selects, textareas | `form-fields.tsx` | `fieldClass` |

---

## 5. Recipes

**Change the sidebar colour.** One line; the top bar follows because both read the
same token.

```css
:root { --chrome-900: #0a1424; }
```

**Change the card background.** In light mode it is one line in `:root`. In dark
mode it is **both** dark blocks, which must stay identical:

```css
@media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { --surface: #1c1c21; --border: #2e2e35; }
}

:root[data-theme="dark"] { --surface: #1c1c21; --border: #2e2e35; }
```

**Recolour every primary button.** `--chrome-800`, plus `--chrome-700` for hover.

**Change button shape everywhere** — corner radius, padding, font weight — edit
`BASE` or `SIZES` in `src/components/ui/button.tsx`.

**Change one button on one screen.** Pass `className`; it is appended last and
wins.

```tsx
<Button className="rounded-full">Add customer</Button>
```

**Add a button variant.** Add a key to `VARIANTS` in `button.tsx` and to the
`ButtonVariant` union. It is then available everywhere.

**Style something that is not a `<div>`** — a `<form>` that is itself a card:

```tsx
import { CARD_CLASS } from "@/components/ui/card";

<form className={`mb-6 ${CARD_CLASS}`}>…</form>
```

---

## 6. Rules that are not preferences

**Gold as text must use `--gold-ink`.** Plain `--gold` on a light card measures
2.42:1, below even the 3:1 large-text floor. Bright gold belongs on dark
surfaces only.

**Every colour pair must reach WCAG AA (4.5:1), and small text needs more.** The
current palette is checked:

| Pair | Ratio |
|---|---|
| `--foreground` on a card (light) | 21.0 |
| white on `--chrome-800` | 17.7 |
| `--muted` on a card (light) | 7.7 |
| gold on `--chrome-900` | 7.7 |
| `--gold-ink` on the page | 5.4 |

If you change a token, re-check the pairs it participates in.

**Small labels are 12px semibold, never 11px.** Uppercase text with wide tracking
at 11px is hard to read no matter how good the contrast — the tracking thins it
out just as the size does. Every small label uses:

```
text-xs font-semibold uppercase tracking-wide text-muted
```

which lives in `labelClass` in `form-fields.tsx`. The filter panel and the
customer card labels match it.

**Form fields are 16px below `sm:`.** Anything smaller makes iOS Safari zoom the
viewport on focus. This lives once in `fieldClass` — do not give a screen its own
input styling.

**Buttons are 44px tall on touch widths** (`py-2.5`, tightening at `sm:`).

See SRS §8.1 (NFR-12) for the full responsive rules.

---

## 7. After editing `globals.css`

Turbopack caches the compiled stylesheet and does not always notice. If a change
appears to do nothing:

```
Ctrl+C
Remove-Item -Recurse -Force .next
npm run dev
```

then hard-reload the browser (Ctrl+Shift+R).

The tell that it is the cache and not your code: compare the class names in `src`
against the served stylesheet. If the source uses a class the CSS does not
define, the build is stale.
