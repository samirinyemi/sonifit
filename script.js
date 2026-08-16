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

  /* ------------------------------------------------------------ hero intro */

  function reveal() {
    root.classList.remove('js-anim');
  }

  // No GSAP (blocked, offline, failed request): show the finished state and
  // stop. The page must never depend on the animation.
  if (typeof window.gsap === 'undefined') {
    reveal();
    return;
  }

  var gsap = window.gsap;
  var hasSplit = typeof window.SplitText !== 'undefined';
  if (hasSplit) gsap.registerPlugin(window.SplitText);

  // Reduced motion: skip the entrance and the typing outright, but keep the
  // cursor — it is a pointer affordance, not decoration. It just stops easing.
  if (reduce.matches) {
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

  // Two independent states, because they answer two different questions.
  //
  // `is-scrolled` — has the page moved at all? Drops the centre mark. Fires
  // almost immediately, which is what makes it feel responsive.
  //
  // `is-over-page` — is the bar still over the hero footage, or has it reached
  // the cream ground? This one drives colour. It cannot share the first
  // threshold: switching to near-black 40px into a 100vh hero would put dark
  // text on dark video for the rest of the section.
  function buildNav() {
    var bar = document.querySelector('.nav-bar');
    if (!bar) return;

    var dark = document.querySelector('.hero, .ath-hero');

    function update() {
      bar.classList.toggle('is-scrolled', window.scrollY > 40);

      var overDark = false;
      if (dark) {
        // the bar sits at the top, so compare against the dark block's bottom
        var edge = dark.getBoundingClientRect().bottom;
        overDark = edge > bar.getBoundingClientRect().bottom;
      }
      bar.classList.toggle('is-over-page', !overDark);
    }

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
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
      holdInPlace(title, {
        endTrigger: next || section,
        end: next ? 'top 20%' : 'bottom center'
      });
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
      q('.ath__title').forEach(function (copy) {
        holdInPlace(copy, { endTrigger: section, end: 'bottom center' });
      });
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
  var failsafe = window.setTimeout(reveal, 3000);

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

  // Wait for fonts before splitting — line breaks measured against a fallback
  // face would be wrong once the real face swaps in.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start).catch(start);
  } else {
    start();
  }
})();
