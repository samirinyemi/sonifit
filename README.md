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
| `assets/js/` | GSAP 3.13 + SplitText + ScrollTrigger, Lenis 1.3.26, and the slit-scan hover shader. All self-hosted — no CDN at runtime. |
| `assets/js/slitscan.js` | The WebGL hover crossing on the collection cards. Self-contained, no GSAP. |
| `tools/crop-products.sh` | Build step: re-cuts every product photograph to its frame's aspect ratio. |
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

## Loading screen

One overlay, one sequence, and the hero intro does not start until it is gone —
the two never overlap.

| Time | What |
| --- | --- |
| `0.00` | The frame rises from below the fold at 72% size and settles dead centre at full size |
| `0.25` | The two side lines fade up, 0.1s apart |
| `0.20` | The counter runs **0 → 100** over 1.9s |
| — | Every on-body photograph in the collection flips through the frame, stepped by the counter itself rather than its own timer, so the number and the images can never drift apart |
| `2.25` | The whole sheet leaves upward. Nothing fades — the frame, the type and the counter stay lit and ride up on the ground they are printed on. The hero showreel starts from frame zero on the same beat, so it is already running as it is uncovered |

`is-loading` is set on `<html>` in the `<head>`, before first paint, and the
overlay only exists while it is there. Every exit from `script.js` clears it —
no GSAP, reduced motion, a thrown tween, a missing node — and there is a 9s
timer in the head as a last belt. There is no path that leaves a visitor behind
a blank screen.

The hero video keeps its `autoplay` attribute so it still runs with JS off, but
`script.js` pauses and rewinds it the moment it parses, and only releases it
when the overlay starts moving — nobody watches three seconds of a showreel
from behind a loading screen. Every path that dismisses the overlay starts it,
so a failsafe exit cannot leave a frozen video behind.

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

## Smooth scrolling

[Lenis](https://github.com/darkroomengineering/lenis) 1.3.26, MIT, self-hosted
in `assets/js/` like the rest — no CDN at runtime. Its stylesheet is inlined
into `styles.css` rather than fetched as a second file.

Lenis smooths the wheel but still moves the **real** scroll position — it is
not a transformed proxy. So `window.scrollY`, the sticky nav, the reveal
observers, ScrollTrigger and the browser's own scrollbar all keep working off
the same number they always did, and none of it needs a scroller proxy.

| Setting | Why |
| --- | --- |
| `lerp: 0.1` | Lower lerp, longer coast. Much above 0.15 and the smoothing stops reading as deliberate and starts reading as lag |
| `syncTouch: false` | Touch is left alone. Phones already have momentum scrolling in the OS, and overriding it makes the page feel detached from the finger |
| `anchors: true` | Lenis owns the in-page anchors, so the nav links and the eleven cards pointing at `#collection` glide instead of jumping |
| `autoRaf: false` | GSAP's ticker drives the frame instead |

**One clock.** Lenis steps on `gsap.ticker` and ScrollTrigger updates on every
Lenis scroll event, so the scroll position, the scrubbed triggers and every
tween are measured against the same frame. Left on two independent `rAF`s they
drift a frame apart, which shows up on the scrubbed hold as a title jittering
against the photography behind it. `gsap.ticker.lagSmoothing(0)` goes with it:
lag smoothing pauses GSAP's clock after a long frame, which would strand Lenis
mid-glide with no frames left to finish it.

Native `scroll-behavior: smooth` is scoped to `html:not(.lenis)` — the two
animate the same position and fight, making anchor jumps stutter or land
short. With JS off, `.lenis` is never added and native smooth anchors are the
fallback.

Lenis is stopped while the loading overlay is up, so wheel deltas do not pile
up behind it and release in a lurch when the sheet lifts, and `start()` lands
the page at the top with `immediate: true` — a 1.5s coast is not something to
measure ScrollTrigger's starts against. Under `prefers-reduced-motion` Lenis
is never constructed at all: that code path returns before it is built, so the
page scrolls natively.

## Scroll choreography

All of it is ScrollTrigger. Two kinds, used deliberately:

**Scrubbed** — tied to the scrollbar, reverses when you scroll back.

| What | Behaviour |
| --- | --- |
| The big uppercase statements | Words start at 18% opacity and light up in sequence, fully lit by the time the block sits mid-screen |
| Collage photographs (athlete page) | Drift at five different rates as the section passes, at **every** width. Above 1280 the rates are per picture (−90 to +100), which is what gives the overlapping frames their depth. Below it the collage is two packed columns with only a few pixels between neighbours, so the drift is set per column instead — 1/3/5 travel up together, 2/4 down — and the depth reads as the columns moving against each other. Spreading the rates within a column there closes those gaps to nothing and the pictures collide |
| The full-bleed plate | Opens from a small centred rectangle (`clip-path: inset(16% 24%)`) to full bleed, with the image easing from 1.18 to 1 |

**Revealed** — the general case, and the only one that is not ScrollTrigger.

Every block with no motion of its own gets `.reveal`: opacity 0 and an 18px
lift, resolving on an IntersectionObserver at `threshold 0.01` and
`rootMargin: 0px 0px -12% 0px`. The negative bottom margin means an element
has to travel a little way up into the viewport before it fires, so blocks
arrive once you have committed to scrolling to them rather than the instant
their first pixel appears. Each fires once and disconnects — re-hiding on the
way back up reads as a gimmick and makes the page feel unstable.

Opacity runs 720ms, the transform 900ms, both on `cubic-bezier(0.22, 0.61,
0.36, 1)`. The transform outlasting the fade by 180ms is the point: the block
is fully readable while it is still settling its last pixels, so it arrives
rather than slides. 18px and no more — longer travel turns a page into a
slideshow and fights the layout.

Three ways of getting the line-by-line feel, and they are not interchangeable:

| Shape | How |
| --- | --- |
| Cards at scattered vertical positions (the collection) | Own observer, **no delay**. They sit at different heights, so the viewport edge reaches them at different moments and they arrive in reading order out of the geometry alone. It self-times to scroll speed — trickling when you scroll slowly, arriving as a wave when you scroll fast. An index stagger here would fight the layout and fire cards still off screen |
| Items on one horizontal row (the five portraits) | Geometry cannot separate them, so stagger explicitly: `index * 70ms` |
| Stacked text (the footer) | Hand-tuned down the stack — 0, 90, 140, 200 — capped at 200ms total. One composition arriving, not five events |

It is strictly additive. `.reveal` on its own is the finished state; the only
place `opacity: 0` is ever written is inside `@media (prefers-reduced-motion:
no-preference)`. Reduced motion, a missing `IntersectionObserver`, or no JS at
all leaves a plain static page — nothing is hidden from a crawler or a screen
reader, and nothing waits on a script to become readable. State is a
`data-shown` attribute and the delay is a `--reveal-delay` custom property
read by the transition, so there are no inline styles and no `setTimeout`
stagger drifting out of sync with the transition it leads.

The hero is exempt — it is above the fold and already animating on load — as
is anything fixed or overlaid (nav, cursor, loader).

**Triggered** — fires once on entry and plays through at its own speed,
so you never have to keep scrolling to finish what you have started reading.

| What | Behaviour |
| --- | --- |
| Athlete cards (home) | Each card owns its trigger, fading up 60px over 0.9s as it crosses 88% of the viewport |
| Collage photographs | Fade in one at a time as the section arrives |

**Pinned**

The word "Athletes" pins when it reaches the middle of the screen and holds
until the end of its section reaches the middle — the photography keeps
scrolling past a held title. Same on the athlete page for the name, where
*both* copies (solid and stroke-only) hold together, so the outline stays
registered with the pictures moving behind it.

Neither title is released in open space. Each holds until the section below it
arrives, and that section carries an opaque ground — the CTA photograph on the
home page, `--bg` painted onto `.ath-statement--first` on the athlete page —
so the title is taken out of the page rather than left to slide away, and is
never seen again further down. On the athlete page the clearance under the
collage is `padding-top` rather than `margin-top` for exactly this reason: a
margin leaves the gap transparent and the name would show while crossing it.

The hold derives its start from `offsetTop` on the title's `offsetParent`,
never from the title's own bounding box — the box carries the transform the
hold itself writes, so measuring it would let the trigger chase its own
output. It also refuses a measurement it knows is impossible: a refresh that
lands before the browser has clamped scroll to a newly shortened document
reports every position short by the overshoot, and `start` comes back
negative. Progress then reads 1 before you have scrolled at all and the title
is written a full section-height down — off screen, permanently, with nothing
left to correct it. In that case the title keeps its natural position and one
more refresh is requested a frame later, once things have settled.

Pins use `pinSpacing: false` — the titles are absolutely positioned inside
their scatter canvases, and spacing would push the whole canvas down. Pinning
is gated to `min-width: 1280px` via `gsap.matchMedia()`; below that the
scatters become columns and a pin would read as a glitch.

### Splitting text

Two different SplitText modes, for two different reasons:

- **Lines**, with `mask: 'lines'` — the hero paragraph and the athlete page's
  lede and note. Each line slides up from behind its own clipping edge. Reverted
  on completion so the text re-wraps natively on resize.
- **Words**, with `tag: 'span'` and `display: inline` — the statements. The
  default (inline-block `div`s) re-flows the paragraph into a broken grid;
  plain inline spans keep the wrapping identical to the unsplit text, and
  opacity animates fine on an inline box.

## Collection hover — the slit-scan

Each product card carries two photographs: the garment alone and the same
garment on the body. The crossing between them is a shader, in
`assets/js/slitscan.js`.

The frame is cut into **14 vertical bands**. Band *N* opens once the crossing
passes `N / 14 × 0.42`, then runs out the rest of the window — so the change
sweeps left to right across the frame instead of happening all at once, and
every band still lands exactly at the end rather than being left short. Inside
each band the outgoing photograph slips vertically by `0.055` of the frame
while the incoming one arrives from the opposite direction, and the direction
alternates band to band, so it reads as interleaved strips rather than one
wipe with a soft edge. An RGB channel split peaks at the halfway point of each
band and resolves to exactly zero at both ends — `0.0035` in UV, small enough
to read as press misregistration rather than glitch art. 750ms in, 600ms out.

Nothing scales, lifts or shadows. The transition *is* the interaction; the
composition, the grid and the captions stay where they are.

Three decisions carry the implementation:

**One canvas, one context — moved, not positioned.** There is a single WebGL
context for the whole grid, and it is `appendChild`-ed into the frame of the
card under the pointer. No coordinate maths, correct at every breakpoint, and
eleven cards can never exhaust the browser's context budget. Moving to a second
card detaches it from the first, which snaps back to its still photograph —
the correct state for a card the pointer has left.

**Strictly an upgrade, never a dependency.** The markup already crosses the two
`<img>` elements with a plain CSS opacity transition. Only once a live context
exists *and* its program has linked does `slitscan.js` set
`[data-fx-mode="gl"]` on the grid, which is the flag that tells the stylesheet
to stand down. No-JS, no-WebGL, touch and reduced-motion visitors all still get
the second photograph. Keyboard focus keeps the CSS crossfade in every case —
there is no pointer there to drive a shader. It is gated on
`(hover: hover) and (pointer: fine)` and `prefers-reduced-motion: no-preference`,
and a lost context drops the flag and hands the crossing straight back to CSS.

**Hover is tracked synchronously.** A decode that resolves *after* the pointer
has already left must not switch the effect on with nothing left to turn it
off. `pointerenter` sets the flag before anything can await; the enter is
re-checked against it on the other side of the decode. When both photographs
are already decoded — the normal case, since you cannot hover what has not been
painted — there is a synchronous fast path with no microtask at all.

### The build step

```bash
site/tools/crop-products.sh
```

Re-cuts every product photograph from the untouched export in
`../Collection images` to the exact aspect ratio of the frame it sits in, and
writes it to `assets/products/`. The frame ratio is the same at every
breakpoint — `--w * --u` by `--h * --u` above 1280, `aspect-ratio: --w / --h`
below it — so one crop covers every viewport, and the frame sizes are read
straight out of `index.html` so they cannot drift from the markup.

That is what lets the shader sample a trivial 0-1 UV with no cover fit, and it
leaves the markup as a plain `object-fit: cover`, which is exactly what the
fallback needs anyway. **The product images are versioned with `?v=` for the
same reason as the CSS and JS**: the filenames do not change when the crop
does, and a cached 16:9 texture in a 4:3 frame would stretch.

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
- **Product hover.** See below — the `_Hover` files shipped in
  `Collection images` cross over in a WebGL shader, with a CSS crossfade
  underneath for everyone the shader does not serve.
- **Contrast.** `#FF2D2D` on `#FFF5F5` measures **3.43:1**. That passes for large
  type but is under the 4.5:1 WCAG AA threshold for the 13px labels and 15px body
  copy. Left as designed — worth a decision before this goes anywhere real. A
  darker ground fixes it (`#0E0A0A` measures 5.30:1) if the design ever allows it.
- **Assets** were downscaled and re-encoded (163MB → 7MB). The 4K hero showreel
  is now 1080p at 2.5MB with a poster frame; originals remain untouched in the
  parent folder.
