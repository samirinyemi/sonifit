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
        gsap.set(q('.hero [data-anim]').concat(q('.wordmark__letter')), { clearProps: 'all' });
        gsap.set(q('.ath__lede, .ath__note'), { clearProps: 'all' });
        if (rule) gsap.set(rule, { clearProps: 'all' });
        if (typeof window.ScrollTrigger !== 'undefined') window.ScrollTrigger.refresh();
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

    // Each card owns its own trigger and plays through at its own speed the
    // moment it enters. Not scrubbed — a scrubbed reveal makes you keep
    // scrolling to finish what the eye has already started reading.
    cards.forEach(function (card) {
      gsap.fromTo(card,
        { opacity: 0, y: 60 },
        {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: card, start: 'top 88%', once: true }
        });
    });

    // Only above the reflow breakpoint. Below it the scatter becomes a column
    // and the title sits in normal flow, where pinning would read as a glitch.
    if (!title || typeof gsap.matchMedia !== 'function') return;

    gsap.matchMedia().add('(min-width: 1280px)', function () {
      window.ScrollTrigger.create({
        trigger: title,
        start: 'center center',
        endTrigger: section,
        end: 'bottom center',
        pin: title,
        // the title is absolutely positioned in the scatter; spacing would
        // push the whole canvas down
        pinSpacing: false
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
    // they can run as separate scrubbed tweens without fighting each other.
    gsap.fromTo(imgs,
      { opacity: 0 },
      {
        opacity: 1,
        ease: 'none',
        stagger: 0.4,
        scrollTrigger: { trigger: section, start: 'top 85%', end: 'center 60%', scrub: true }
      });

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

      // Both copies of the name pin together — the solid one under the
      // photography and the stroke-only one above it — so the outline keeps
      // registering with the pictures as they move past. They share a single
      // trigger element: measured separately, the stroked copy is a couple of
      // dozen pixels taller and would pin at a different scroll position.
      var copies = q('.ath__title');
      var lead = copies[0];

      copies.forEach(function (copy) {
        window.ScrollTrigger.create({
          trigger: lead,
          start: 'center center',
          endTrigger: section,
          end: 'bottom center',
          pin: copy,
          pinSpacing: false
        });
      });
    });
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
  }

  // Wait for fonts before splitting — line breaks measured against a fallback
  // face would be wrong once the real face swaps in.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start).catch(start);
  } else {
    start();
  }
})();
