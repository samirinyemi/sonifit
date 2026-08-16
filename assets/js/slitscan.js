/* SONIFIT — collection hover crossing.
   ------------------------------------------------------------------------
   Every product card carries two photographs: the garment alone, and the same
   garment on the body. The crossing between them is an editorial slit-scan —
   the frame is cut into 14 vertical bands that open left to right on a
   stagger, each band slipping its two images past each other in opposite
   directions, with a hair of RGB misregistration at the midpoint.

   Two rules shape the whole file:

   1. ONE canvas, ONE WebGL context for the entire grid. It is not positioned
      over the hovered card — it is *moved into* it with appendChild, so there
      is no coordinate maths, it is correct at every breakpoint, and eleven
      cards can never exhaust the browser's context budget.

   2. It is strictly an upgrade. The markup already crosses the two <img>
      elements with a plain CSS opacity transition. Only once a live context
      exists and the program links does this set [data-fx-mode="gl"] on the
      grid, which is what tells the stylesheet to stand down. No-JS, no-WebGL,
      touch and reduced-motion visitors all still get the second photograph.

   The textures are pre-cropped to each frame's exact aspect ratio by
   tools/crop-products.sh, which is why the shader samples a trivial 0-1 UV
   with no cover fit. */

(function () {
  'use strict';

  /* ------------------------------------------------------------- settings */

  var BANDS = 14;
  var STAGGER = 0.42;    // band N opens at N/BANDS * this
  var SLIP = 0.055;      // vertical travel, as a fraction of the frame
  var SPLIT = 0.0035;    // channel separation in UV — press artefact, not glitch
  var ENTER = 750;       // ms
  var LEAVE = 600;       // ms

  /* ----------------------------------------------------------------- gate */

  function media(query) {
    return window.matchMedia && window.matchMedia(query).matches;
  }

  // Pointer-driven and decorative: no touch, no coarse pointer, no reduced
  // motion. Each of those visitors keeps the CSS crossing.
  if (!media('(hover: hover) and (pointer: fine)')) return;
  if (!media('(prefers-reduced-motion: no-preference)')) return;

  var grid = document.querySelector('.scatter--products');
  if (!grid) return;

  /* --------------------------------------------------------------- shaders */

  var VERT = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aPos * 0.5 + 0.5;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  // highp matters here: the channel split is 0.0035 of a UV that runs to 1.0,
  // and mediump would quantise it away on some mobile-class GPUs.
  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',

    'varying vec2 vUv;',

    'uniform sampler2D uFrom;',
    'uniform sampler2D uTo;',
    'uniform float uProgress;',
    'uniform float uBands;',
    'uniform float uStagger;',
    'uniform float uSlip;',
    'uniform float uSplit;',

    'const float PI = 3.141592653589793;',

    'vec3 misregister(sampler2D tex, vec2 uv, float amount) {',
    '  return vec3(',
    '    texture2D(tex, uv + vec2(amount, 0.0)).r,',
    '    texture2D(tex, uv).g,',
    '    texture2D(tex, uv - vec2(amount, 0.0)).b',
    '  );',
    '}',

    'void main() {',
    '  float band = min(floor(vUv.x * uBands), uBands - 1.0);',

    // Band N opens once progress passes N/BANDS * STAGGER, then runs out the
    // rest of the window — so the crossing sweeps across the frame, and every
    // band still lands exactly at progress 1 rather than being left short.
    '  float start = (band / uBands) * uStagger;',
    '  float local = clamp((uProgress - start) / max(1.0 - start, 0.0001), 0.0, 1.0);',
    '  float e = smoothstep(0.0, 1.0, local);',

    // Alternate the slip per band so it reads as interleaved strips rather
    // than one wipe with a soft edge.
    '  float dir = mod(band, 2.0) < 0.5 ? 1.0 : -1.0;',

    '  vec2 fromUv = vUv + vec2(0.0, dir * uSlip * e);',
    '  vec2 toUv   = vUv - vec2(0.0, dir * uSlip * (1.0 - e));',

    // Peaks at the halfway point of each band and resolves to exactly zero at
    // both ends — sin(0) and sin(PI) are 0, so no band can settle misaligned.
    '  float amount = uSplit * sin(local * PI);',

    '  vec3 col = mix(misregister(uFrom, fromUv, amount),',
    '                 misregister(uTo, toUv, amount), e);',

    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* -------------------------------------------------------------- context */

  var canvas = document.createElement('canvas');
  canvas.className = 'product__fx';
  canvas.setAttribute('aria-hidden', 'true');

  var attrs = {
    alpha: false,            // the canvas covers the frame edge to edge
    antialias: false,        // nothing is drawn with an edge to alias
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'low-power'
  };

  var gl = canvas.getContext('webgl', attrs) ||
           canvas.getContext('experimental-webgl', attrs);
  if (!gl) return;

  function compile(type, source) {
    var s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

  gl.useProgram(program);

  // One oversized triangle instead of two: same coverage, no shared edge.
  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  var aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var uProgress = gl.getUniformLocation(program, 'uProgress');

  gl.uniform1i(gl.getUniformLocation(program, 'uFrom'), 0);
  gl.uniform1i(gl.getUniformLocation(program, 'uTo'), 1);
  gl.uniform1f(gl.getUniformLocation(program, 'uBands'), BANDS);
  gl.uniform1f(gl.getUniformLocation(program, 'uStagger'), STAGGER);
  gl.uniform1f(gl.getUniformLocation(program, 'uSlip'), SLIP);
  gl.uniform1f(gl.getUniformLocation(program, 'uSplit'), SPLIT);

  /* ------------------------------------------------------------- textures */

  // The photographs are not powers of two, so WebGL 1 only allows them with
  // CLAMP_TO_EDGE and a non-mipmapped filter. Clamping is what we want anyway:
  // the slip pushes UVs past the edge and they must smear, never wrap.
  function upload(img) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  function decoded(img) {
    return img.complete && img.naturalWidth > 0;
  }

  function whenDecoded(img) {
    if (decoded(img)) return Promise.resolve();
    if (typeof img.decode === 'function') return img.decode();
    return new Promise(function (resolve, reject) {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', reject, { once: true });
    });
  }

  /* ---------------------------------------------------------------- state */

  var active = null;     // the card record the canvas currently lives in
  var progress = 0;
  var target = 0;
  var duration = ENTER;
  var frame = 0;
  var stamp = 0;

  function resize() {
    // Cap the pixel ratio: a 3x buffer on a 700px frame buys nothing visible
    // and costs real fill rate.
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.round(active.box.clientWidth * dpr));
    var h = Math.max(1, Math.round(active.box.clientHeight * dpr));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }

  function draw() {
    if (!active) return;
    resize();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, active.from);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, active.to);
    gl.uniform1f(uProgress, progress);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function tick(now) {
    frame = 0;
    var dt = stamp ? now - stamp : 16;
    stamp = now;

    var step = dt / duration;
    if (target > progress) progress = Math.min(target, progress + step);
    else progress = Math.max(target, progress - step);

    draw();

    if (progress !== target) {
      frame = window.requestAnimationFrame(tick);
      return;
    }

    stamp = 0;
    // Fully unwound: give the frame back to the stylesheet rather than leave a
    // canvas parked in every card the pointer has ever touched.
    if (progress === 0) release();
  }

  function play(to, ms) {
    target = to;
    duration = ms;
    if (!frame) {
      stamp = 0;
      frame = window.requestAnimationFrame(tick);
    }
  }

  function release() {
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    active = null;
  }

  function begin(rec) {
    if (!rec.from) {
      rec.from = upload(rec.still);
      rec.to = upload(rec.hover);
    }

    if (active !== rec) {
      // Moving the canvas is the whole trick — appendChild detaches it from
      // whichever card had it. A card the pointer has already left snaps back
      // to its still photograph, which is the correct state for it.
      progress = 0;
      active = rec;
      rec.box.appendChild(canvas);
      canvas.width = 0;   // force a resize against the new frame
      // Paint progress 0 now rather than on the first frame of the tween. It
      // is pixel-identical to the still photograph underneath, so the canvas
      // never appears as an empty box, however late the first tick lands.
      draw();
    }

    play(1, ENTER);
  }

  /* ----------------------------------------------------------------- wire */

  var records = [];

  Array.prototype.forEach.call(grid.querySelectorAll('.product'), function (card) {
    var box = card.querySelector('.product__media');
    if (!box) return;

    var imgs = box.querySelectorAll('.product__img');
    if (imgs.length < 2) return;

    var rec = {
      box: box,
      still: imgs[0],
      hover: imgs[1],
      from: null,
      to: null,
      hovered: false
    };
    records.push(rec);

    card.addEventListener('pointerenter', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;

      // Tracked synchronously, before anything can await. The decode below may
      // resolve long after the pointer has moved on, and an effect that
      // switches itself on at that point would be stuck on with nothing to
      // turn it off.
      rec.hovered = true;

      if (decoded(rec.still) && decoded(rec.hover)) {
        begin(rec);       // fast path: no microtask, no dropped first frame
        return;
      }

      Promise.all([whenDecoded(rec.still), whenDecoded(rec.hover)])
        .then(function () {
          if (rec.hovered) begin(rec);
        })
        .catch(function () { /* the CSS crossing is still underneath */ });
    });

    card.addEventListener('pointerleave', function () {
      rec.hovered = false;
      if (active === rec) play(0, LEAVE);
    });
  });

  if (!records.length) return;

  // Everything above succeeded: a live context, a linked program and at least
  // one wired card. Only now does the stylesheet hand the crossing over.
  grid.setAttribute('data-fx-mode', 'gl');

  // The canvas is sized in device pixels, so a window resize (or a zoom) has
  // to re-measure it. Only ever while a card is actually showing one.
  window.addEventListener('resize', function () {
    if (active) draw();
  });

  // A lost context leaves a blank canvas over the photograph. Drop the flag and
  // the effect together, and the CSS crossing takes over again.
  canvas.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    progress = 0;
    target = 0;
    release();
    grid.removeAttribute('data-fx-mode');
  });
})();
