# SONIFIT — editorial landing page

Static implementation of the Figma design
[Free-class / Home Page](https://www.figma.com/design/Je9r2o1pSgv9TiIkPfyzcE/Free-class?node-id=48-1092)
(node `48:1092`). No build step, no dependencies.

## Run

```bash
python3 -m http.server 5173 --directory site
```

Then open <http://localhost:5173>.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | Home page. Every block keeps its `data-node-id` back to Figma. |
| `athlete.html` | Athlete detail page (Figma `42:280`). Linked from every athlete card. |
| `styles.css` | All styling, tokens and breakpoints. |
| `script.js` | Scrollbar measurement, hero intro timeline, reduced-motion handling. |
| `assets/js/` | GSAP 3.13 + SplitText, self-hosted. No CDN at runtime. |
| `assets/` | Video, images, SVG exports. |

## Palette

| Token | Value | Role |
| --- | --- | --- |
| `--red` | `#FF2D2D` | all type, rules, the cursor, the wordmark |
| `--bg` | `#FFF5F5` | page ground |
| `--ink` | `#060605` | the dark ground behind the hero video and CTA photo |
| `--white` | `#FFFFFF` | only ever on red: the CTA button, the cursor label |

Two colours, as designed. Changing the ground is a one-line edit: `--bg`.

## How the responsive model works

The Figma frame is **1440 wide with a 1400 content column and 20px gutters**.

`--u` is "one Figma pixel" — the live content column divided by 1400, **not
capped**:

```css
--u: calc((100vw - var(--sbw) - 40px) / 1400);
```

Every dimension lifted from Figma is written as `calc(<figma value> * var(--u))`,
so the layout is full-bleed: it grows and shrinks with the viewport and holds
exact Figma proportion at any width. There is no max-width anywhere.

Two classes of type behave differently:

| Class | Examples | Behaviour |
| --- | --- | --- |
| **Display** | SONIFIT wordmark, the About statement, "Athletes", CTA title, "The Collection", "©26", "Lets Talk" | Scales with `--u`, so it always fills its column edge to edge |
| **Fixed** | nav, hero blurb, all labels, athlete names, product name/price/weight, footer copy | Stays 13 / 15 / 20px at every width — reflows, never resizes |

Tracking is in `em` and line-heights are unitless, so both classes keep their
Figma letterspacing at any scale.

**Fixed type gets a fixed measure.** A fixed-size paragraph inside a scaling
column would change its line count with the viewport, so every body column is
pinned to its Figma px width and only its *position* scales:

| Element | Width |
| --- | --- |
| Hero blurb | `335px` — always three lines |
| CTA impact / figures column | `335px` |
| Collection details | `547px`, anchored 159 (scaled) short of the right edge |
| Footer detail | `335px` |
| Athlete lede / note | `336px` / `279px` |

The nav logo mark is fixed at `29px` for the same reason — it is a brand asset,
not layout, so it holds its Figma size instead of growing with the frame. (The
footer mark still scales; say the word if it should match.)

| Viewport | Behaviour |
| --- | --- |
| **≥ 1280px** | Full-bleed scaled composition. Section tops and heights stay in exact Figma proportion. Hero height is capped at `100svh` so the wordmark and its intro always land on the first screen. |
| **≤ 1279px** | Scaling stops (`--u: 1px`). The two scattered canvases (Athletes, Collection) reflow into a packed two-column layout via CSS multi-column, and the hero fills the viewport. |
| **≤ 560px** | Single column throughout, plus a portrait rebalance of the hero. |

### The hero on phones

The wordmark is a fixed 5.28:1 lockup, so on a narrow screen it can never be
proportionally as large as it is in Figma (25% of the hero height there, ~9%
at 375px). The most it can be is the full width of the screen, so below 560px
it breaks the gutters and runs edge to edge, and everything above it tightens
so the type block reads as a deliberate base rather than a strip stranded under
a void.

Also at that width: the nav stays one row rather than wrapping (it fits at 12px
even at 320px), and the meta becomes two rows, with "© 2026" pinned to the right
edge instead of crammed against the CTA.

### Cache busting

`styles.css` and `script.js` are linked with a `?v=` query. Vercel caches static
assets hard, so **bump that number in both HTML files whenever you change either
file**, or returning visitors keep the old one.

The scattered sections use `--l / --t / --w / --h` inline custom properties
holding the raw Figma coordinates — so a position change in Figma is a one-number
edit in the HTML.

## Hero intro (GSAP)

The wordmark is **inlined SVG**, one `<g class="wordmark__letter">` per letter,
so each of the seven letters is independently animatable. The whole sequence is
one timeline in `script.js`:

| Time | What |
| --- | --- |
| `0.00` | Nav items rise and fade in, 0.06s apart |
| `0.15` | Hero paragraph arrives **line by line** — SplitText with `mask: "lines"`, so each line slides up from behind its own clipping edge |
| `0.40` | The four meta labels stagger in |
| `0.55` | The hairline draws left to right (`scaleX 0 → 1`) |
| `0.60` | **SONIFIT** — each letter rises out of the bottom edge with `stagger: { from: "random" }`, so the order shuffles every load. T can land before S. |

`.hero__wordmark` has `overflow: hidden`, which is what makes the letters read as
rising *out of* the composition rather than just sliding.

Robustness:

- The pre-animation hidden state lives behind a `.js-anim` class set in `<head>`.
  If GSAP fails to load, or `prefers-reduced-motion` is set, the class is never
  added / is removed immediately and the finished hero renders normally.
- The split is reverted and all inline styles cleared on completion, so the
  paragraph re-wraps natively on resize.
- A 3s failsafe reveals the hero if the intro never starts.

The athlete page reuses the same timeline — its nav, name and two descriptions
carry `data-anim` and stagger in together.

## Typewriter — "The Collection"

The heading types itself out when it scrolls into view (ScrollTrigger,
`start: "top 85%"`, fires once), with a caret blinking at the cursor.

- Per-character delay is randomised (42–97ms) with an extra beat after a space
  and an occasional longer hesitation, so the cadence reads as a person rather
  than a metronome.
- The real text is in the markup; JS reads it, clears it, and types it back — so
  with JS off the heading is simply there.
- The heading's finished height is locked with `min-height` before typing, so
  the details column beside it does not jump as lines appear.
- The caret is `display: none` until `.is-typing` is on the heading, and comes
  off ~0.9s after the last character.

## Custom cursor

A red dot rides the pointer across both pages. Over a collection card it grows
into a red circle reading **See More**.

It is one element. Built at full size (110px) and scaled down to a 9px dot, so
following and resizing are pure transforms — no layout, no repaint. Position
runs through `gsap.quickTo` with a 0.12s ease, which gives the dot a little
weight without lagging behind the pointer.

- Cards opt in with `data-cursor="See More"` on the `<article class="product">`.
  The attribute value becomes the label, so a different card can say something
  else without touching the JS.
- The native pointer stays visible everywhere — the dot sits on top of it, as
  intended. `cursor: none` applies **only** over a card, where the circle
  replaces it. To hide the system cursor site-wide instead, move that rule from
  `.has-cursor [data-cursor]` to `.has-cursor body`.
- Built by `script.js` only when `(hover: hover) and (pointer: fine)` matches,
  so touch devices never get it.
- Under `prefers-reduced-motion` the cursor still works — it just stops easing
  (`duration: 0`). It is a pointer affordance, not decoration.
- Hidden when the pointer leaves the window, restored on re-entry.

## Athlete detail page

`athlete.html` is Figma `42:280` — Eliud Kipchoge. Same header, footer, scaling
model and reflow rules as the home page.

The name is set twice: a solid copy underneath the photography and a
stroke-only copy (`-webkit-text-stroke`, transparent fill) above it. Wherever a
photo covers the name, you see the outline — the effect in the design. The
outline copy is `aria-hidden` and dropped entirely below 1280px, where the
collage stacks and nothing overlaps.

**All five athlete cards link here.** Only Kipchoge has copy and photography in
the Figma file, so the other four currently land on his page. When there is
content for the rest, the page wants to become data-driven (one JSON map, one
`?athlete=` param) rather than four more copies of this file.

## Notes

- **Typeface.** The design uses Neue Haas Grotesk Text Pro (licensed). The stack
  falls back to Helvetica Neue, which is the same skeleton, so metrics are close
  but not identical. Drop the real webfont into `assets/` and the stack picks it
  up with no other change.
- **Product hover.** The `_Hover` files shipped in `Collection images` are wired
  up as a crossfade on hover/focus.
- **Contrast.** `#FF2D2D` on `#FFF5F5` measures **3.43:1**. That passes for large
  type but is under the 4.5:1 WCAG AA threshold for the 13px labels and 15px body
  copy. Left as designed — worth a decision before this goes anywhere real. A
  darker ground fixes it (`#0E0A0A` measures 5.30:1) if the design ever allows it.
- **Assets** were downscaled and re-encoded (163MB → 7MB). The 4K hero showreel
  is now 1080p at 2.5MB with a poster frame; originals remain untouched in the
  parent folder.
