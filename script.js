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

  /* ----------------------------------------------------------------- theme */

  // Dark is the default; the stored choice is applied by the inline script in
  // <head> so light mode never flashes dark. This only wires the switch, and
  // runs before the GSAP checks below — the theme is functionality, not
  // decoration, so it must work with animations off or GSAP missing.
  (function themeSwitch() {
    var KEY = 'sonifit-theme';
    var toggle = document.querySelector('.theme-toggle');
    if (!toggle) return;

    var meta = document.querySelector('meta[name="theme-color"]');

    function apply(theme, persist) {
      var light = theme === 'light';

      if (light) root.setAttribute('data-theme', 'light');
      else root.removeAttribute('data-theme');

      toggle.setAttribute('aria-checked', light ? 'false' : 'true');
      toggle.setAttribute('aria-label', light ? 'Light mode' : 'Dark mode');

      if (meta) meta.setAttribute('content', light ? '#fff5f5' : '#0e0a0a');

      if (persist) {
        try { localStorage.setItem(KEY, theme); } catch (e) { /* private mode */ }
      }
    }

    // Sync the control with whatever the head script already decided.
    apply(root.getAttribute('data-theme') === 'light' ? 'light' : 'dark', false);

    toggle.addEventListener('click', function () {
      apply(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light', true);
    });
  })();

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

  function buildIntro() {
    var letters = q('.wordmark__letter');
    var navItems = q('.nav [data-anim]');
    var metaItems = q('.hero__meta [data-anim]');
    var rule = document.querySelector('.hero .rule');
    var blurb = document.querySelector('.hero__blurb');

    // Split the hero paragraph into lines so it can arrive line by line.
    // `mask: 'lines'` wraps each line in a clipping box, so the lines slide up
    // from behind their own edge rather than just fading.
    var split = null;
    var blurbTargets = blurb ? [blurb] : [];

    if (blurb && hasSplit) {
      try {
        split = new window.SplitText(blurb, { type: 'lines', mask: 'lines', linesClass: 'line' });
        if (split.lines && split.lines.length) blurbTargets = split.lines;
      } catch (e) {
        split = null;
      }
    }

    // The CSS pre-state hides these; GSAP drives them from here on.
    if (blurb) gsap.set(blurb, { opacity: 1 });

    var tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: function () {
        // Give the paragraph its original markup back so it re-wraps cleanly
        // on resize, and hand every element back to the stylesheet.
        if (split) split.revert();
        reveal();
        gsap.set(q('.hero [data-anim]').concat(q('.wordmark__letter')), { clearProps: 'all' });
        if (rule) gsap.set(rule, { clearProps: 'all' });
      }
    });

    // Each page only has some of these, so every step is guarded.
    function step(targets, from, to, at) {
      if (targets && targets.length) tl.fromTo(targets, from, to, at);
    }

    step(navItems,
      { y: 14, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, stagger: 0.06 }, 0);

    step(blurbTargets,
      { yPercent: 110, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.9, stagger: 0.09 }, 0.15);

    step(metaItems,
      { y: 16, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, stagger: 0.07 }, 0.4);

    // Anything else marked for the intro — the athlete page's title and its two
    // descriptions land here, so both pages share one entrance.
    var rest = q('[data-anim]').filter(function (el) {
      return navItems.indexOf(el) < 0 && metaItems.indexOf(el) < 0 && el !== blurb;
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
    step(letters,
      { y: 300, opacity: 0 },
      {
        y: 0,
        opacity: 1,
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

  /* -------------------------------------------------------- typewriter ---- */

  // "The Collection" types itself out when it scrolls into view, with a caret
  // blinking at the cursor. Delays vary per character — an even cadence reads
  // like a machine, not a person.
  function buildTypewriter() {
    var el = document.querySelector('[data-typewriter]');
    if (!el) return;

    var heading = el.closest('h1, h2, h3') || el.parentNode;
    var full = el.textContent;

    function delayFor(ch, prev) {
      var base = 42 + Math.random() * 55;
      if (prev === ' ') base += 60;            // a beat before a new word
      if (ch === ' ') base += 20;
      if (Math.random() < 0.07) base += 130;   // the occasional hesitation
      return base;
    }

    function type() {
      // Lock the finished height first so nothing below jumps as lines appear.
      heading.style.minHeight = heading.getBoundingClientRect().height + 'px';
      heading.classList.add('is-typing');
      el.textContent = '';

      var i = 0;
      (function next() {
        if (i >= full.length) {
          window.setTimeout(function () {
            heading.classList.remove('is-typing');
            heading.style.minHeight = '';
          }, 900);
          return;
        }
        el.textContent += full.charAt(i);
        var prev = full.charAt(i);
        i += 1;
        window.setTimeout(next, delayFor(full.charAt(i), prev));
      })();
    }

    if (typeof window.ScrollTrigger === 'undefined') {
      type();
      return;
    }

    gsap.registerPlugin(window.ScrollTrigger);
    window.ScrollTrigger.create({
      trigger: heading,
      start: 'top 85%',
      once: true,
      onEnter: type
    });
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
      buildTypewriter();
    } catch (e) { /* the title is already in the markup; leave it be */ }
    try {
      buildCursor();
    } catch (e) { /* decoration only — the native pointer still works */ }
  }

  // Wait for fonts before splitting — line breaks measured against a fallback
  // face would be wrong once the real face swaps in.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start).catch(start);
  } else {
    start();
  }
})();
