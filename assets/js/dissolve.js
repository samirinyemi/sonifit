/* SONIFIT — displacement dissolve for the collection cards.
 *
 * On hover the product shot dissolves into its hover shot through a noise
 * field: instead of a flat crossfade, the incoming image bleeds in as an
 * organic wipe, and both images pull slightly along the noise gradient while
 * it happens.
 *
 * One WebGL context for the whole page. Only one card can be hovered at a
 * time, so a single canvas is moved into whichever card is active — eleven
 * contexts would sit right on the browser's ~16 limit.
 *
 * Everything here is an enhancement. If WebGL is missing, the pointer is
 * coarse, or anything throws, the CSS crossfade underneath is left alone.
 */
(function () {
  'use strict';

  var VERT = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aPos * 0.5 + 0.5;',
    '  vUv.y = 1.0 - vUv.y;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform sampler2D uFrom;',
    'uniform sampler2D uTo;',
    'uniform float uProgress;',
    'varying vec2 vUv;',

    'float hash(vec2 p) {',
    '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
    '}',

    /* value noise — the wipe's grain. Low frequency reads as cloth or smoke;
       high frequency reads as static. 5.0 sits about where fabric does. */
    'float noise(vec2 p) {',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
    '}',

    'void main() {',
    '  float n = noise(vUv * 5.0) * 0.75 + noise(vUv * 13.0) * 0.25;',
    '  float p = uProgress;',

    /* Remap so the threshold always clears both ends: at p=0 nothing has
       wiped, at p=1 everything has, regardless of the noise distribution. */
    '  float t = p * 1.4 - 0.2;',
    '  float m = smoothstep(n - 0.16, n + 0.16, t);',

    /* Each image drags along the noise gradient, strongest mid-wipe. */
    '  float pull = sin(p * 3.14159) * 0.06;',
    '  vec2 d = (vec2(n) - 0.5) * pull;',

    '  vec4 from = texture2D(uFrom, vUv + d);',
    '  vec4 to = texture2D(uTo, vUv - d);',
    '  gl_FragColor = mix(from, to, m);',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh) || 'shader compile failed');
    }
    return sh;
  }

  function makeTexture(gl) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  function init() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var cards = Array.prototype.slice.call(
      document.querySelectorAll('.product__media')
    );
    if (!cards.length) return;

    var canvas = document.createElement('canvas');
    canvas.className = 'dissolve';
    canvas.setAttribute('aria-hidden', 'true');

    var gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false })
          || canvas.getContext('experimental-webgl');
    if (!gl) return;

    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || 'link failed');
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var uProgress = gl.getUniformLocation(prog, 'uProgress');
    var texFrom = makeTexture(gl);
    var texTo = makeTexture(gl);

    gl.uniform1i(gl.getUniformLocation(prog, 'uFrom'), 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'uTo'), 1);

    var state = { p: 0 };
    var active = null;
    var tween = null;

    function upload(unit, tex, img) {
      gl.activeTexture(unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    }

    function draw() {
      gl.uniform1f(uProgress, state.p);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function size(media) {
      var r = media.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.max(1, Math.round(r.width * dpr));
      var h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
    }

    function enter(media) {
      var imgs = media.querySelectorAll('.product__img');
      var base = imgs[0];
      var hover = imgs[1];
      if (!base || !hover || !base.complete || !hover.complete) return;
      if (!base.naturalWidth || !hover.naturalWidth) return;

      active = media;
      media.classList.add('is-gl');
      media.appendChild(canvas);
      size(media);

      upload(gl.TEXTURE0, texFrom, base);
      upload(gl.TEXTURE1, texTo, hover);

      if (tween) tween.kill();
      tween = window.gsap
        ? window.gsap.to(state, { p: 1, duration: 0.85, ease: 'power2.inOut', onUpdate: draw })
        : null;
      if (!tween) { state.p = 1; draw(); }
    }

    function leave(media) {
      if (active !== media) return;
      if (tween) tween.kill();
      tween = window.gsap
        ? window.gsap.to(state, {
            p: 0,
            duration: 0.6,
            ease: 'power2.inOut',
            onUpdate: draw,
            onComplete: function () {
              media.classList.remove('is-gl');
              if (canvas.parentNode === media) media.removeChild(canvas);
              active = null;
            }
          })
        : null;
      if (!tween) {
        state.p = 0;
        media.classList.remove('is-gl');
        if (canvas.parentNode === media) media.removeChild(canvas);
        active = null;
      }
    }

    cards.forEach(function (media) {
      media.addEventListener('pointerenter', function () { enter(media); });
      media.addEventListener('pointerleave', function () { leave(media); });
      media.addEventListener('focus', function () { enter(media); });
      media.addEventListener('blur', function () { leave(media); });
    });

    window.addEventListener('resize', function () {
      if (active) { size(active); draw(); }
    }, { passive: true });
  }

  try {
    init();
  } catch (e) {
    /* the CSS crossfade is still in place */
  }
})();
