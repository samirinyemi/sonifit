/* SONIFIT — runtime.
   1. Measures the scrollbar so the `--u` scaling unit is derived from the
      real content width, not the viewport including the scrollbar.
   2. Hero intro built with GSAP: the wordmark letters rise one at a time in
      random order, everything else staggers in line by line.
   3. Respects prefers-reduced-motion throughout. */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------------- layout */

  function setScrollbarWidth() {
    var sbw = window.innerWidth - root.clientWidth;
    root.style.setProperty('--sbw', (sbw > 0 ? sbw : 0) + 'px');
  }

  setScrollbarWidth();

  var resizeTimer;
  window.addEventListener('resize', function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(setScrollbarWidth, 120);
  });

  /* ----------------------------------------------------------------- video */

  var video = document.querySelector('.hero__video');

  function applyMotionPreference() {
    if (!video) return;
    if (reduce.matches) {
      video.pause();
      video.removeAttribute('autoplay');
    } else {
      var play = video.play();
      if (play && typeof play.catch === 'function') play.catch(function () {});
    }
  }

  applyMotionPreference();

  if (typeof reduce.addEventListener === 'function') {
    reduce.addEventListener('change', applyMotionPreference);
  }

  /* ------------------------------------------------------------- sticky nav */

  // Runs ahead of the GSAP and reduced-motion guards: a sticky, legible nav is
  // functionality, not decoration, so it must work with animations off or the
  // animation libraries missing.
  try {
    buildNav();
  } catch (e) { /* the bar stays red, which is the hero state */ }

  /* ---------------------------------------------------------------- loader */

  // The overlay exists only while `is-loading` is on <html> — set in the head
  // so it is up before first paint. Every path out of this file has to clear
  // it, or the page is left behind a blank screen until the head's failsafe
  // timer fires.
  function closeLoader() {
    root.classList.remove('is-loading');
  }

  /* ------------------------------------------------------------ hero intro */

  function reveal() {
    root.classList.remove('js-anim');
  }

  // No GSAP (blocked, offline, failed request): show the finished state and
  // stop. The page must never depend on the animation.
  if (typeof window.gsap === 'undefined') {
    closeLoader();
    reveal();
    return;
  }

  var gsap = window.gsap;
  var hasSplit = typeof window.SplitText !== 'undefined';
  if (hasSplit) gsap.registerPlugin(window.SplitText);

  // Reduced motion: skip the entrance and the typing outright, but keep the
  // cursor — it is a pointer affordance, not decoration. It just stops easing.
  if (reduce.matches) {
    closeLoader();
    reveal();
    try {
      buildCursor();
    } catch (e) { /* decoration only */ }
    return;
  }

  var q = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  // Reverting a SplitText changes layout, so ScrollTrigger has to remeasure.
  // Doing that from inside a completion handler recalculates while a pin is
  // mid-flight, which corrupts every other trigger's start/end. Batch them
  // into one refresh on a later tick instead.
  var refreshTimer;

  function scheduleRefresh() {
    if (typeof window.ScrollTrigger === 'undefined') return;
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(function () {
      window.ScrollTrigger.refresh();
    }, 250);
  }

  // Split an element into masked lines, so they can slide up from behind their
  // own clipping edge rather than just fading. Returns the line elements, or
  // the element itself if SplitText is unavailable.
  var splits = [];

  function intoLines(el) {
    if (!el) return [];
    if (!hasSplit) return [el];
    try {
      var s = new window.SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'line' });
      if (s.lines && s.lines.length) {
        splits.push(s);
        return s.lines;
      }
    } catch (e) { /* fall through */ }
    return [el];
  }

  function buildIntro() {
    var letters = q('.wordmark__letter');
    var navItems = q('.nav [data-anim]');
    var metaItems = q('.hero__meta [data-anim]');
    var rule = document.querySelector('.hero .rule');
    var blurb = document.querySelector('.hero__blurb');

    // Everything that arrives line by line: the home hero paragraph and the
    // two descriptions in the athlete page collage.
    var paras = [blurb].concat(q('.ath__lede, .ath__note')).filter(Boolean);
    var lineTargets = [];

    paras.forEach(function (p) {
      lineTargets = lineTargets.concat(intoLines(p));
      // The CSS pre-state hides these; GSAP drives them from here on.
      gsap.set(p, { opacity: 1 });
    });

    var tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: function () {
        // Give the paragraphs their original markup back so they re-wrap
        // cleanly on resize, and hand every element back to the stylesheet.
        splits.forEach(function (s) { s.revert(); });
        splits.length = 0;
        reveal();
        // Every animated element, not just the ones inside .hero — the nav now
        // lives in the fixed bar, and a leftover inline opacity there would
        // outrank the stylesheet rule that fades the mark out on scroll.
        gsap.set(q('[data-anim]').concat(q('.wordmark__letter')), { clearProps: 'all' });
        gsap.set(q('.ath__lede, .ath__note'), { clearProps: 'all' });
        if (rule) gsap.set(rule, { clearProps: 'all' });
        scheduleRefresh();
      }
    });

    // Each page only has some of these, so every step is guarded.
    function step(targets, from, to, at) {
      if (targets && targets.length) tl.fromTo(targets, from, to, at);
    }

    step(navItems,
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, stagger: 0.06 }, 0);

    step(lineTargets,
      { yPercent: 110, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.09 }, 0.15);

    step(metaItems,
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, stagger: 0.07 }, 0.4);

    // Anything else marked for the intro — the athlete page title lands here,
    // so both pages share one entrance. The paragraphs are excluded: they are
    // already animating line by line above.
    var rest = q('[data-anim]').filter(function (el) {
      return navItems.indexOf(el) < 0 && metaItems.indexOf(el) < 0 && paras.indexOf(el) < 0;
    });

    step(rest,
      { y: 22, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.85, stagger: 0.1 }, 0.2);

    step(rule ? [rule] : [],
      { scaleX: 0 },
      { scaleX: 1, duration: 1, ease: 'power3.inOut' }, 0.55);

    // The payoff: each letter of SONIFIT rises out of the bottom edge of its
    // clipped box. `from: 'random'` shuffles the order, so it is never a plain
    // left-to-right sweep — T might land before S.
    //
    // No opacity in the tween: the letters hold 100% throughout and are hidden
    // purely by the clip. The `from` sets opacity 1 inline, which releases them
    // from the CSS pre-state that stops a flash before GSAP takes over.
    step(letters,
      { y: 300, opacity: 1 },
      {
        y: 0,
        duration: 1.15,
        ease: 'power4.out',
        stagger: { each: 0.085, from: 'random' }
      }, 0.6);

    return tl;
  }

  /* ------------------------------------------------------ custom cursor ---- */

  // A red dot rides the pointer across the whole site. Over a collection card
  // it grows into a circle reading "See More". One element, one transform:
  // it is built at full size and scaled down to the dot, so following and
  // resizing never touch layout.
  function buildCursor() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var targets = q('[data-cursor]');

    var el = document.createElement('div');
    el.className = 'cursor';
    el.setAttribute('aria-hidden', 'true');

    var label = document.createElement('span');
    label.className = 'cursor__label';
    label.textContent = targets.length ? targets[0].getAttribute('data-cursor') : 'See More';
    el.appendChild(label);

    document.body.appendChild(el);
    root.classList.add('has-cursor');

    var DOT = 9 / 110;   // the resting dot is 9px across
    var trail = reduce.matches ? 0 : 0.12;   // no easing under reduced motion
    var grow = reduce.matches ? 0 : 0.4;

    gsap.set(el, { xPercent: -50, yPercent: -50, scale: DOT, autoAlpha: 0 });

    var xTo = gsap.quickTo(el, 'x', { duration: trail, ease: 'power3' });
    var yTo = gsap.quickTo(el, 'y', { duration: trail, ease: 'power3' });

    var seen = false;

    window.addEventListener('mousemove', function (e) {
      xTo(e.clientX);
      yTo(e.clientY);
      if (!seen) {
        seen = true;
        gsap.set(el, { x: e.clientX, y: e.clientY });
        gsap.to(el, { autoAlpha: 1, duration: 0.2 });
      }
    }, { passive: true });

    // Don't leave the dot stranded when the pointer leaves the window.
    document.addEventListener('mouseleave', function () {
      gsap.to(el, { autoAlpha: 0, duration: 0.2 });
    });
    document.addEventListener('mouseenter', function () {
      if (seen) gsap.to(el, { autoAlpha: 1, duration: 0.2 });
    });

    targets.forEach(function (target) {
      target.addEventListener('mouseenter', function () {
        label.textContent = target.getAttribute('data-cursor') || 'See More';
        gsap.to(el, { scale: 1, duration: grow, ease: 'power3.out' });
        gsap.to(label, { opacity: 1, duration: grow * 0.6, delay: grow * 0.2 });
      });

      target.addEventListener('mouseleave', function () {
        gsap.to(el, { scale: DOT, duration: grow * 0.875, ease: 'power3.out' });
        gsap.to(label, { opacity: 0, duration: grow * 0.375 });
      });
    });
  }

  /* ------------------------------------------------------------ loader ---- */

  // The load sequence: the frame rises from below the fold small, settles at
  // the centre at full size, and flips through every on-body photograph in the
  // collection while a counter runs 0 to 100. Then the whole overlay leaves
  // upward and the hero intro takes over — the two never overlap.
  //
  // `done` is called exactly once, whatever happens: a broken image, a missing
  // node or a thrown tween must not strand the visitor behind the overlay.
  function buildLoader(loader, done) {
    var box = loader.querySelector('.loader__box');
    var shots = q('.loader__box img', loader);
    var sides = q('.loader__side', loader);
    var count = loader.querySelector('#loader-count');
    var counter = { value: 0 };
    var showing = -1;

    if (!box || !shots.length) {
      closeLoader();
      done();
      return;
    }

    shots[0].classList.add('is-on');

    // Write the opening state synchronously. A timeline renders lazily on its
    // first tick, which would leave one frame of the finished composition —
    // box centred, sides lit — before it snaps down to the start.
    gsap.set(box, { yPercent: 55, scale: 0.72, autoAlpha: 0 });
    if (sides.length) gsap.set(sides, { y: 14, autoAlpha: 0 });

    // One image on at a time, stepped by the counter rather than by its own
    // timer — the flipping and the number are the same motion, so they can
    // never drift apart or finish at different moments.
    function flip(progress) {
      var i = Math.min(shots.length - 1, Math.floor(progress * shots.length));
      if (i === showing) return;
      if (showing >= 0) shots[showing].classList.remove('is-on');
      shots[i].classList.add('is-on');
      showing = i;
    }

    var tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: function () {
        closeLoader();
        done();
      }
    });

    // Below the fold and undersized, so it reads as arriving rather than
    // fading up in place.
    tl.fromTo(box,
      { yPercent: 55, scale: 0.72, autoAlpha: 0 },
      { yPercent: 0, scale: 1, autoAlpha: 1, duration: 1.15 }, 0);

    if (sides.length) {
      tl.fromTo(sides,
        { y: 14, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.7, stagger: 0.1 }, 0.25);
    }

    tl.to(counter, {
      value: 100,
      duration: 1.9,
      ease: 'power1.inOut',
      onUpdate: function () {
        if (count) count.textContent = Math.round(counter.value);
        flip(counter.value / 100);
      }
    }, 0.2);

    // Everything clears before the overlay itself moves, so the exit is one
    // gesture rather than a sheet of type sliding off the top.
    tl.to(sides.concat(count ? [count.parentNode] : []),
      { autoAlpha: 0, duration: 0.35 }, '>-0.05');

    tl.to(box, { scale: 1.08, autoAlpha: 0, duration: 0.5 }, '<');

    tl.to(loader, { yPercent: -100, duration: 0.8, ease: 'power4.inOut' }, '>-0.15');

    return tl;
  }

  /* ----------------------------------------------------- scroll reveal ---- */

  // The big uppercase statements start dim and light up word by word as they
  // pass through the viewport, finishing well before they leave the top.
  // Scrubbed, so the reveal tracks the scrollbar rather than firing once.
  function buildScrollReveal() {
    var blocks = q('.statement');
    if (!blocks.length || !hasSplit || typeof window.ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(window.ScrollTrigger);

    blocks.forEach(function (block) {
      var split;
      try {
        // `tag: 'span'` plus display:inline keeps the paragraph wrapping
        // exactly as it does unsplit — SplitText defaults to inline-block
        // divs, which re-flow the text into a broken grid. Only opacity is
        // animated here, and that works fine on a plain inline box.
        split = new window.SplitText(block, { type: 'words', wordsClass: 'word', tag: 'span' });
      } catch (e) {
        return;
      }
      if (!split.words || !split.words.length) return;

      gsap.set(split.words, { display: 'inline' });

      gsap.fromTo(split.words,
        { opacity: 0.18 },
        {
          opacity: 1,
          ease: 'none',
          stagger: 0.4,
          scrollTrigger: {
            trigger: block,
            start: 'top 85%',   // begins as the block clears the fold
            end: 'bottom 65%',  // fully lit while still comfortably on screen
            scrub: true
          }
        });
    });
  }

  /* --------------------------------------------------------- sticky hold --- */

  // Hold an element at screen centre without ScrollTrigger's `pin`.
  //
  // Both titles that need this are absolutely positioned inside a scatter
  // canvas whose coordinates are driven by --u. ScrollTrigger's pin swaps them
  // to `position: fixed` and inserts a pin-spacer, which computes the wrong
  // coordinates in that context — the title ended up floating over the hero —
  // and the layout churn corrupted the start/end of every other trigger on the
  // page.
  //
  // Translating instead is exact and inert: move the element down by precisely
  // as much as the page scrolls, and it appears to stand still. Nothing leaves
  // the flow, nothing is measured twice, and scrolling back up unwinds it to
  // y: 0 — its original place in the middle of the images.
  // The element must never be its own trigger. Translating it moves its
  // bounding box, ScrollTrigger re-measures that box on the next refresh, the
  // start shifts, the progress changes, and the translate changes again — a
  // feedback loop that parks the title at an arbitrary offset.
  //
  // So: trigger on the element's offsetParent, which is stable, and derive the
  // start from `offsetTop`. Offsets are layout values, unaffected by any
  // transform, so the measurement can never chase itself.
  function holdInPlace(el, opts) {
    if (!el || typeof window.ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(window.ScrollTrigger);

    var anchor = el.offsetParent;
    if (!anchor) return;

    return window.ScrollTrigger.create({
      trigger: anchor,
      start: function () {
        return 'top+=' + (el.offsetTop + el.offsetHeight / 2) + ' center';
      },
      endTrigger: opts.endTrigger,
      end: opts.end,
      invalidateOnRefresh: true,
      onUpdate: function (self) {
        gsap.set(el, { y: (self.end - self.start) * self.progress });
      },
      onRefresh: function (self) {
        gsap.set(el, { y: (self.end - self.start) * self.progress });
      }
    });
  }

  /* ------------------------------------------------------------ sticky nav --- */

  // `is-scrolled` drops the centre mark once the page moves.
  //
  // The colour is red everywhere, always — no blend mode, no second colour on
  // the element. Where the bar crosses a red block, only the *overlapping
  // pixels* turn white. A class switch cannot do that; it repaints the whole
  // element. So the nav is drawn twice: the real one in red, and a white copy
  // stacked exactly on top, clipped to the union of the red blocks currently
  // under the bar. Outside those rectangles the white copy is clipped away and
  // the red original shows through.
  //
  // The clip is an SVG <clipPath> of one <rect> per block, which is how you
  // express a union — CSS clip-path takes a single shape.
  function buildNav() {
    var bar = document.querySelector('.nav-bar');
    if (!bar) return;

    function setScrolled() {
      bar.classList.toggle('is-scrolled', window.scrollY > 40);
    }

    setScrolled();
    window.addEventListener('scroll', setScrolled, { passive: true });

    var shell = bar.querySelector('.shell');
    var nav = bar.querySelector('.nav');
    var reds = Array.prototype.slice.call(document.querySelectorAll('[data-nav-red]'));
    if (!shell || !nav || !reds.length) return;

    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'nav-clip');
    svg.setAttribute('aria-hidden', 'true');
    var clip = document.createElementNS(NS, 'clipPath');
    clip.setAttribute('id', 'nav-red-clip');
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    svg.appendChild(clip);
    document.body.appendChild(svg);

    // The white copy carries no semantics: hidden from assistive tech and
    // untabbable, so the nav is still announced and focused exactly once.
    var overlay = nav.cloneNode(true);
    overlay.classList.add('nav--over-red');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.removeAttribute('aria-label');
    Array.prototype.forEach.call(overlay.querySelectorAll('a, button'), function (el) {
      el.setAttribute('tabindex', '-1');
    });
    Array.prototype.forEach.call(overlay.querySelectorAll('[id]'), function (el) {
      el.removeAttribute('id');
    });
    shell.appendChild(overlay);

    var rects = [];
    var queued = false;

    function paint() {
      queued = false;

      var barBox = bar.getBoundingClientRect();
      var shellBox = shell.getBoundingClientRect();
      var used = 0;

      for (var i = 0; i < reds.length; i++) {
        var r = reds[i].getBoundingClientRect();
        // only blocks actually crossing the bar's band
        if (r.bottom <= barBox.top || r.top >= barBox.bottom) continue;
        if (r.right <= shellBox.left || r.left >= shellBox.right) continue;

        var rect = rects[used];
        if (!rect) {
          rect = document.createElementNS(NS, 'rect');
          rects[used] = rect;
          clip.appendChild(rect);
        }
        // coordinates are relative to the clipped element's own box
        rect.setAttribute('x', r.left - shellBox.left);
        rect.setAttribute('y', r.top - shellBox.top);
        rect.setAttribute('width', r.width);
        rect.setAttribute('height', r.height);
        used++;
      }

      // park the leftovers instead of destroying them — scrolling churns this
      for (var j = used; j < rects.length; j++) {
        rects[j].setAttribute('width', 0);
        rects[j].setAttribute('height', 0);
      }
    }

    function schedule() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(paint);
    }

    paint();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
  }

  /* ------------------------------------------------------- media reveals --- */

  // Every photograph on the site fades up as it arrives and rewinds as it
  // leaves upward — `play none none reverse`. Not scrubbed: each one plays
  // through at its own speed, so you never have to keep scrolling to finish
  // a reveal. The hero is excluded; that one belongs to the load sequence.
  function revealMedia(elements, opts) {
    opts = opts || {};
    if (!elements || !elements.length || typeof window.ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(window.ScrollTrigger);

    elements.forEach(function (el) {
      gsap.fromTo(el,
        { opacity: 0, y: opts.rise === 0 ? 0 : (opts.rise || 60) },
        {
          opacity: 1,
          y: 0,
          duration: opts.duration || 0.9,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: opts.start || 'top 88%',
            toggleActions: 'play none none reverse'
          }
        });
    });
  }

  /* --------------------------------------------------- athletes section --- */

  // Two things move here. The cards fade up one at a time as the section
  // passes, and the word "Athletes" pins once it reaches the middle of the
  // screen and stays there until the end of the section reaches the middle —
  // so the photography keeps scrolling past a held title.
  function buildAthletes() {
    var section = document.querySelector('.athletes');
    var title = document.querySelector('.athletes__title');
    var cards = q('.athletes .athlete');
    if (!section || !cards.length || typeof window.ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(window.ScrollTrigger);

    revealMedia(cards);

    // Only above the reflow breakpoint. Below it the scatter becomes a column
    // and the title sits in normal flow, where pinning would read as a glitch.
    if (!title || typeof gsap.matchMedia !== 'function') return;

    if (!title || typeof gsap.matchMedia !== 'function') return;

    gsap.matchMedia().add('(min-width: 1280px)', function () {
      var next = document.querySelector('.cta');
      var st = holdInPlace(title, {
        endTrigger: next || section,
        end: next ? 'top 20%' : 'bottom center'
      });

      // Below the breakpoint matchMedia reverts this context and kills the
      // trigger — but the y values are written from inside onUpdate, long
      // after the context was recorded, so GSAP does not know to undo them.
      // Without this the title is stranded at its last offset, a full 1387px
      // down and completely out of sight.
      return function () {
        if (st) st.kill();
        gsap.set(title, { clearProps: 'transform' });
      };
    });
  }

  /* ------------------------------------------------ athlete page scroll --- */

  // The collage: photographs fade in one at a time, then drift at different
  // rates as the section passes. The name holds in the middle of the screen
  // until the end of the section reaches it, so the pictures slide past it.
  function buildAthleteHero() {
    var section = document.querySelector('.ath-hero');
    var imgs = q('.ath__img');
    if (!section || !imgs.length || typeof window.ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(window.ScrollTrigger);

    // Reveal and parallax touch different properties of the same element, so
    // they never fight. The reveal plays through on entry and rewinds on the
    // way back up; the parallax below stays scroll-linked.
    revealMedia(imgs, { rise: 0, duration: 0.8 });

    if (typeof gsap.matchMedia !== 'function') return;

    gsap.matchMedia().add('(min-width: 1280px)', function () {
      var depths = [-90, 70, -60, 100, -75];

      imgs.forEach(function (img, i) {
        gsap.to(img, {
          y: depths[i % depths.length],
          ease: 'none',
          scrollTrigger: { trigger: section, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });

      // Both copies of the name hold together — the solid one under the
      // photography and the stroke-only one above it — so the outline keeps
      // registering with the pictures as they move past. They share a single
      // trigger element: measured separately, the stroked copy is a couple of
      // dozen pixels taller and would start at a different scroll position.
      // Both copies share an offsetParent and an offsetTop, so they compute
      // the same start without needing to share a trigger element.
      var copies = q('.ath__title');
      var holds = copies.map(function (copy) {
        return holdInPlace(copy, { endTrigger: section, end: 'bottom center' });
      });

      // Same reason as the home page: clear the offsets by hand when the
      // breakpoint stops matching, or the names are left off-screen.
      return function () {
        holds.forEach(function (st) { if (st) st.kill(); });
        gsap.set(copies, { clearProps: 'transform' });
      };
    });
  }

  // A block of copy arrives line by line, each line climbing out from behind
  // its own clipping edge, staggered in DOM order. Triggered once on entry
  // rather than scrubbed, so it plays through at its own pace.
  //
  // No pre-hidden CSS state is needed: the mask does the hiding, so if the
  // script never runs the copy is simply there.
  function maskedReveal(container, selector, opts) {
    opts = opts || {};
    if (!container || !hasSplit || typeof window.ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(window.ScrollTrigger);

    var localSplits = [];
    var lines = [];

    q(selector, container).forEach(function (el) {
      try {
        var s = new window.SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'line' });
        if (s.lines && s.lines.length) {
          localSplits.push(s);
          lines = lines.concat(s.lines);
          return;
        }
      } catch (e) { /* fall through to the element itself */ }
      lines.push(el);
    });

    if (!lines.length) return;

    var tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      scrollTrigger: { trigger: container, start: opts.start || 'top 70%', once: true },
      onComplete: function () {
        // Hand the markup back so it re-wraps natively on resize.
        localSplits.forEach(function (s) { s.revert(); });
        scheduleRefresh();
      }
    });

    tl.fromTo(lines,
      { yPercent: 110 },
      { yPercent: 0, duration: 0.9, stagger: opts.stagger || 0.045 }, 0);

    if (opts.tail) {
      tl.fromTo(opts.tail,
        { y: 24, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7 }, '-=0.35');
    }
  }

  function buildCopyReveals() {
    var cta = document.querySelector('.cta');
    if (cta) {
      // DOM order is the stagger order: headline, then each side block.
      maskedReveal(cta, '.cta__title, .cta__side p.label, .cta__side p.body, .cta__figures li', {
        start: 'top 65%',
        tail: cta.querySelector('.btn')
      });
    }

    maskedReveal(
      document.querySelector('.collection__head'),
      '.collection__title, .collection__lede, .collection__details .body p',
      { start: 'top 80%' }
    );

    // The eleven product cards, same rule as every other photograph.
    revealMedia(q('.scatter--products .product'));
  }

  // The full-bleed plate opens from a small centred rectangle to full width as
  // it scrolls in. clip-path keeps it on the compositor — no reflow.
  function buildPlate() {
    var plate = document.querySelector('.ath-plate');
    if (!plate || typeof window.ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(window.ScrollTrigger);

    var track = { trigger: plate, start: 'top 95%', end: 'top 20%', scrub: true };

    gsap.fromTo(plate,
      { clipPath: 'inset(16% 24% 16% 24%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', scrollTrigger: track });

    var img = plate.querySelector('img');
    if (img) {
      gsap.fromTo(img,
        { scale: 1.18 },
        { scale: 1, ease: 'none', scrollTrigger: Object.assign({}, track) });
    }
  }

  // Safety net: if the intro never starts for any reason, show the hero anyway.
  // Long enough to sit behind the whole load sequence — the intro is gated on
  // it, and firing early would reveal the hero while the overlay is still up.
  var failsafe = window.setTimeout(function () {
    closeLoader();
    reveal();
  }, 6000);

  function start() {
    window.clearTimeout(failsafe);

    // Land at the top before anything is measured. Some browsers restore the
    // previous scroll position after load even with scrollRestoration set to
    // manual, and ScrollTrigger would then compute every start/end against a
    // scrolled document — which puts the sticky title over the hero and makes
    // reveals fire in the wrong places.
    window.scrollTo(0, 0);
    try {
      buildIntro();
    } catch (e) {
      reveal();
    }
    try {
      buildCursor();
    } catch (e) { /* decoration only — the native pointer still works */ }
    try {
      buildScrollReveal();
    } catch (e) { /* statements stay at full opacity, which is the end state */ }
    try {
      buildAthletes();
    } catch (e) { /* cards stay visible, which is the end state */ }
    try {
      buildAthleteHero();
    } catch (e) { /* collage stays visible */ }
    try {
      buildPlate();
    } catch (e) { /* plate stays at full bleed */ }
    try {
      buildCopyReveals();
    } catch (e) { /* copy stays visible, which is the end state */ }
  }

  // The load sequence runs first and the hero intro starts the moment it is
  // off — never both at once. If there is no overlay (the athlete page, or a
  // visitor whose head script never ran) the intro just starts.
  function boot() {
    var loader = document.getElementById('loader');
    if (!loader || !root.classList.contains('is-loading')) {
      closeLoader();
      start();
      return;
    }
    try {
      buildLoader(loader, start);
    } catch (e) {
      closeLoader();
      start();
    }
  }

  // Wait for fonts before splitting — line breaks measured against a fallback
  // face would be wrong once the real face swaps in.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(boot).catch(boot);
  } else {
    boot();
  }
})();
