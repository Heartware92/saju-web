'use client';

/**
 * 오프닝 인트로 — WebGL 프래그먼트 셰이더 우주 배경
 *
 * 디자인 툴/이미지 없이 GPU 로 직접 그린다:
 *  - fbm 노이즈 성운(도메인 워프 2겹)   - 반짝이는 다층 별필드
 *  - 보랏빛 발광 포켓 + 장미빛 지평선     - 느린 드리프트 + 비네트
 *
 * 풀스크린 쿼드 1장이라 비용이 매우 낮다(파티클 아님).
 * WebGL 미지원/실패 시 CSS 듀스크 그라데이션으로 폴백.
 * prefers-reduced-motion 이면 한 프레임만 그리고 정지.
 */

import { useEffect, useRef } from 'react';

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform float u_time;
uniform vec2 u_res;

float hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.0 + 7.3;
    a *= 0.5;
  }
  return v;
}
float starLayer(vec2 uv, float scale, float speed){
  uv *= scale;
  vec2 id = floor(uv);
  vec2 gv = fract(uv) - 0.5;
  float n = hash(id);
  float present = step(0.93, n);
  vec2 off = (vec2(hash(id + 1.7), hash(id + 4.3)) - 0.5) * 0.7;
  float d = length(gv - off);
  float s = present * smoothstep(0.06, 0.0, d);
  s *= 0.4 + 0.6 * sin(u_time * speed + n * 30.0);
  return max(s, 0.0);
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / u_res;
  vec2 p = (frag - 0.5 * u_res) / u_res.y;

  float t = u_time * 0.03;

  // 성운 — 도메인 워프
  float n1 = fbm(p * 1.8 + vec2(t, t * 0.6));
  float n2 = fbm(p * 3.2 + n1 * 1.5 - vec2(t * 0.8, t));

  vec3 deep     = vec3(0.043, 0.027, 0.094);
  vec3 mid      = vec3(0.176, 0.122, 0.290);
  vec3 amethyst = vec3(0.478, 0.333, 0.533);
  vec3 violet   = vec3(0.788, 0.651, 1.000);
  vec3 rose     = vec3(0.910, 0.643, 0.565);

  vec3 col = deep;
  col = mix(col, mid, smoothstep(0.15, 0.85, n1));
  col = mix(col, amethyst, smoothstep(0.55, 0.95, n2) * 0.7);

  // 보랏빛 발광 포켓
  float bloom = pow(smoothstep(0.6, 1.0, fbm(p * 1.3 + 12.0 + t)), 2.0);
  col += violet * bloom * 0.22;

  // 하단 장미빛 지평선
  col = mix(col, col + rose * 0.18, (1.0 - smoothstep(0.0, 1.0, uv.y)) * 0.6);

  // 별 — 3겹
  float s = 0.0;
  s += starLayer(p + 3.1, 8.0, 2.2);
  s += starLayer(p + 8.7, 14.0, 3.1) * 0.8;
  s += starLayer(p + 1.4, 22.0, 1.7) * 0.6;
  col += vec3(1.0, 0.98, 0.92) * s;

  // 비네트
  float vig = 1.0 - 0.55 * pow(length(uv - vec2(0.5, 0.42)) * 1.3, 2.2);
  col *= clamp(vig, 0.4, 1.0);

  gl_FragColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export default function ShaderSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (canvas.getContext('webgl', { antialias: false, alpha: false }) ||
      canvas.getContext('experimental-webgl', { antialias: false, alpha: false })) as WebGLRenderingContext | null;
    if (!gl) return; // CSS 폴백 유지

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    // 풀스크린 쿼드
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_res');

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let start = 0;

    const draw = (now: number) => {
      if (!start) start = now;
      resize();
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(draw);
    };

    if (reduce) {
      gl.uniform1f(uTime, 8.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 z-0 h-full w-full"
      style={{
        // WebGL 실패 시 보이는 폴백 (듀스크 그라데이션)
        background:
          'linear-gradient(180deg, #0f0920 0%, #1a1230 25%, #2d1f4a 55%, #4a3968 80%, #7a5588 100%)',
      }}
    />
  );
}
