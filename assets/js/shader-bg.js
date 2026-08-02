(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

  // Generative field — Class 4 dynamics, fully continuous (no visible lattice)
  const FIELD = `
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// value noise with smooth interpolation
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 0.0) + vec2(0.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = m * p * 2.05;
    a *= 0.5;
  }
  return v;
}

float wave(vec2 p, float t) {
  float v = 0.0;
  v += sin(p.x * 1.55 + t * 0.28 + sin(p.y * 1.15 - t * 0.18) * 1.15);
  v += sin(p.y * 1.85 - t * 0.22 + sin(p.x * 0.95 + t * 0.24) * 1.25);
  v += sin((p.x + p.y) * 1.05 + t * 0.14);
  return v / 3.0;
}

// Continuous Class-4-ish activity: narrow-band nonlinearity + temporal persistence
// (edge of chaos without any visible pixels / cells)
float class4(vec2 p, float t) {
  // slow drifting sample — X (leftward) even lazier than Y
  vec2 q = p * 2.4;
  q += 0.35 * vec2(fbm(q + t * 0.06), fbm(q + vec2(5.2, 1.3) - t * 0.09));

  float n = fbm(q);
  float n2 = fbm(q * 1.7 + vec2(t * 0.04, -t * 0.05));
  float mixed = n * 0.65 + n2 * 0.35;

  // birth/survive band — only mid activity lives (Class 4 edge)
  float band = smoothstep(0.32, 0.42, mixed) * (1.0 - smoothstep(0.58, 0.72, mixed));
  // lingering structures: blend with a delayed field (glider persistence)
  float delayed = fbm(q - vec2(t * 0.025, t * 0.03) + 2.7);
  float persist = delayed * smoothstep(0.3, 0.45, mixed) * (1.0 - smoothstep(0.6, 0.75, mixed));

  return clamp(band * 0.85 + persist * 0.55, 0.0, 1.0);
}

float veins(vec2 p, float t) {
  float acc = 0.0;
  float amp = 1.0;
  vec2 q = p;
  float c4 = class4(p * 0.9, t);
  // generative field only steers the warp — never draws a grid
  q += 0.18 * vec2(c4 - 0.5, fbm(p + t * 0.05) - 0.5);

  // denser, more even filament field
  for (int i = 0; i < 7; i++) {
    q += 0.32 * vec2(wave(q * 1.2 + 2.1, t), wave(q * 1.2 + 7.9, t));
    q += 0.07 * vec2(c4 - 0.5, wave(q + c4, t));
    float f = abs(wave(q * 2.35, t));
    // wider capture so veins fill space more evenly
    float width = mix(0.1, 0.055, clamp(c4, 0.0, 1.0));
    float line = 1.0 - smoothstep(0.0, width, f);
    line = pow(line, 1.75);
    acc += amp * line * (0.9 + 0.35 * c4);
    amp *= 0.58;
    q *= 1.55;
  }

  // second oriented pass — fills gaps for even trabeculae
  vec2 r = p.yx * 1.15 + vec2(1.7, -0.9);
  r += 0.2 * vec2(wave(r + t * 0.1, t), wave(r - t * 0.08, t));
  float amp2 = 0.55;
  for (int j = 0; j < 4; j++) {
    float f2 = abs(wave(r * 2.8, t * 0.95));
    float line2 = pow(1.0 - smoothstep(0.0, 0.08, f2), 1.7);
    acc += amp2 * line2;
    amp2 *= 0.55;
    r *= 1.6;
  }

  // fine grain mesh
  float fine = abs(wave(q * 4.2 + c4, t * 1.1));
  float fine2 = abs(wave(p.yx * 5.1 - t * 0.06, t));
  acc += 0.38 * pow(1.0 - smoothstep(0.0, 0.04, fine), 2.1);
  acc += 0.22 * pow(1.0 - smoothstep(0.0, 0.035, fine2), 2.2);
  return acc;
}
`;

  // Background — continuous bone, generative motion, no pixel lattice
  const FRAG_BG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
${FIELD}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes.xy) / min(uRes.x, uRes.y);
  // overall slower; horizontal (leftward) drift especially lazy
  float t = uTime * 0.14;
  float tX = uTime * 0.09;

  vec2 q = p;
  q += 0.28 * vec2(wave(p * 0.9, tX), wave(p * 0.9 + 3.7, t));
  float f = wave(q * 1.25, t * 0.7);
  f += 0.42 * wave(q * 2.5 + 11.2, t * 0.5);

  float c4 = class4(p * 1.05, t);
  float v = veins(p * 1.4, t);

  vec3 ivory  = vec3(0.945, 0.938, 0.925);
  vec3 marrow = vec3(0.84, 0.828, 0.808);
  vec3 ink    = vec3(0.38, 0.37, 0.365);

  float shade = smoothstep(-0.75, 0.9, f);
  vec3 col = mix(marrow, ivory, shade);

  // soft generative breath in the marrow — smooth, never blocky
  col = mix(col, ivory, c4 * 0.1);

  float ridge = clamp(v, 0.0, 2.0);
  col = mix(col, vec3(0.96, 0.955, 0.945), pow(smoothstep(0.05, 1.05, ridge), 1.25) * 0.78);

  float seam = pow(smoothstep(0.3, 1.35, ridge), 1.65);
  col = mix(col, ink, seam * (0.32 + 0.12 * c4));

  vec3 sheen = 0.5 + 0.5 * cos(6.28318 * (v * 0.55 + c4 * 0.2 + vec3(0.02, 0.3, 0.58)));
  float lum = dot(sheen, vec3(0.299, 0.587, 0.114));
  sheen = mix(vec3(lum), sheen, 0.32);
  // green fringes → steel / grey-blue (lip stays untouched)
  float gPush = max(0.0, sheen.g - max(sheen.r, sheen.b));
  sheen.g -= gPush * 0.9;
  sheen.b += gPush * 0.7;
  sheen.r += gPush * 0.12;
  col = mix(col, col * sheen, smoothstep(0.25, 0.95, ridge) * 0.16);

  // single lip-rose vein — quieter, drifts left more slowly
  vec3 lip = vec3(0.72, 0.34, 0.40);
  vec2 lv = p * 1.05 + vec2(0.8, -0.35);
  lv += 0.45 * vec2(wave(lv * 0.9, tX * 0.7), wave(lv * 0.9 + 4.2, t * 0.65));
  lv += 0.2 * vec2(fbm(lv + tX * 0.03) - 0.5, fbm(lv.yx - t * 0.03) - 0.5);
  float lipLine = abs(wave(lv * 1.55 + 2.0, tX * 0.55));
  float lipVein = pow(1.0 - smoothstep(0.0, 0.024, lipLine), 2.8);
  float lipGlow = pow(1.0 - smoothstep(0.0, 0.07, lipLine), 2.2) * 0.22;
  col = mix(col, lip, clamp(lipVein * 0.28 + lipGlow * 0.1, 0.0, 0.4));

  float halo = 1.0 - 0.14 * length(uv - vec2(0.5, 0.32));
  col *= halo;
  col = clamp(col, 0.0, 1.0);

  gl_FragColor = vec4(col, 1.0);
}
`;

  // Gentle translucent veil — continuous generative wash over windows
  const FRAG_OVERLAY = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
${FIELD}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes.xy) / min(uRes.x, uRes.y);
  float t = uTime * 0.12;

  float c4 = class4(p * 0.95, t);
  float v = veins(p * 1.1 + 0.4, t * 0.85);
  float f = wave(p * 1.4, t);

  vec3 tint = 0.5 + 0.5 * cos(6.28318 * (f * 0.35 + v * 0.2 + c4 * 0.12 + vec3(0.0, 0.33, 0.67)));
  float lum = dot(tint, vec3(0.299, 0.587, 0.114));
  tint = mix(vec3(lum), tint, 0.38);
  tint = mix(vec3(0.88, 0.885, 0.9), tint, 0.55);
  // green wash → steel blue
  float gPush = max(0.0, tint.g - max(tint.r, tint.b));
  tint.g -= gPush * 0.9;
  tint.b += gPush * 0.7;
  tint.r += gPush * 0.12;

  float ridge = clamp(v, 0.0, 1.8);
  float a = 0.04 + ridge * 0.15 + c4 * 0.035;
  a += 0.03 * (0.5 + 0.5 * sin(f * 2.0 + t));
  a += pow(smoothstep(0.3, 1.1, ridge), 1.85) * 0.13;

  gl_FragColor = vec4(tint, clamp(a, 0.0, 0.36));
}
`;

  function makeLayer(canvas, fragSrc, opts) {
    if (!canvas) return null;
    const alpha = !!(opts && opts.alpha);
    const gl =
      canvas.getContext("webgl", { antialias: false, alpha: alpha, premultipliedAlpha: false }) ||
      canvas.getContext("experimental-webgl", { antialias: false, alpha: alpha });
    if (!gl) {
      canvas.remove();
      return null;
    }

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }

    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) {
      canvas.remove();
      return null;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const loc = gl.getAttribLocation(prog, "aPos");
    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");

    if (alpha) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    return {
      canvas,
      gl,
      prog,
      loc,
      uRes,
      uTime,
      alpha,
      draw(time) {
        const scale = Math.min(window.devicePixelRatio || 1, 2) * (alpha ? 0.7 : 0.95);
        const w = Math.floor(window.innerWidth * scale);
        const h = Math.floor(window.innerHeight * scale);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          canvas.style.width = window.innerWidth + "px";
          canvas.style.height = window.innerHeight + "px";
        }
        gl.viewport(0, 0, w, h);
        gl.useProgram(prog);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        if (alpha) {
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.uniform2f(uRes, w, h);
        gl.uniform1f(uTime, time);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
  }

  const bg = makeLayer(document.getElementById("shader-bg"), FRAG_BG, { alpha: false });
  const overlay = makeLayer(document.getElementById("shader-overlay"), FRAG_OVERLAY, { alpha: true });
  if (!bg && !overlay) return;

  const start = performance.now();

  function frame(now) {
    const t = (now - start) * 0.001;
    if (bg) bg.draw(t);
    if (overlay) overlay.draw(t);
    if (!reduceMotion) requestAnimationFrame(frame);
  }

  window.addEventListener("resize", () => {
    if (reduceMotion) requestAnimationFrame(frame);
  });

  requestAnimationFrame(frame);
})();
