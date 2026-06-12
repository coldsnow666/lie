/**
 * @Description: ReactBits Faulty Terminal 背景：用 OGL 渲染终端数字噪声、扫描线和故障漂移。
 *
 * @Date 2026-06-12 14:47
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { Color, Mesh, Program, Renderer, Triangle } from "ogl";

type Vec2 = [number, number];
type Vec3 = [number, number, number];

export type FaultyTerminalProps = {
  brightness?: number;
  chromaticAberration?: number;
  className?: string;
  curvature?: number;
  digitSize?: number;
  dither?: boolean | number;
  dpr?: number;
  flickerAmount?: number;
  glitchAmount?: number;
  gridMul?: Vec2;
  mouseReact?: boolean;
  mouseStrength?: number;
  noiseAmp?: number;
  onFallback?: () => void;
  onReady?: () => void;
  pageLoadAnimation?: boolean;
  paused?: boolean;
  scale?: number;
  scanlineIntensity?: number;
  style?: CSSProperties;
  timeScale?: number;
  tint?: string;
};

function hexToRgb(hex: string): Vec3 {
  const normalized = hex.replace("#", "").trim();
  const fullHex = normalized.length === 3 ? normalized.split("").map((char) => char + char).join("") : normalized.padEnd(6, "0");
  const value = parseInt(fullHex, 16);

  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

const vertexShader = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision mediump float;

varying vec2 vUv;

uniform float iTime;
uniform vec3 iResolution;
uniform float uScale;

uniform vec2 uGridMul;
uniform float uDigitSize;
uniform float uScanlineIntensity;
uniform float uGlitchAmount;
uniform float uFlickerAmount;
uniform float uNoiseAmp;
uniform float uChromaticAberration;
uniform float uDither;
uniform float uCurvature;
uniform vec3 uTint;
uniform vec2 uMouse;
uniform float uMouseStrength;
uniform float uUseMouse;
uniform float uPageLoadProgress;
uniform float uUsePageLoadAnimation;
uniform float uBrightness;

float time;

float hash21(vec2 p) {
  p = fract(p * 234.56);
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  return sin(p.x * 10.0) * sin(p.y * (3.0 + sin(time * 0.090909))) + 0.2;
}

mat2 rotate(float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float fbm(vec2 p) {
  p *= 1.1;
  float f = 0.0;
  float amp = 0.5 * uNoiseAmp;

  mat2 modify0 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify0 * p * 2.0;
  amp *= 0.454545;

  mat2 modify1 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify1 * p * 2.0;
  amp *= 0.454545;

  mat2 modify2 = rotate(time * 0.08);
  f += amp * noise(p);

  return f;
}

float pattern(vec2 p, out vec2 q, out vec2 r) {
  vec2 offset1 = vec2(1.0);
  vec2 offset0 = vec2(0.0);
  mat2 rot01 = rotate(0.1 * time);
  mat2 rot1 = rotate(0.1);

  q = vec2(fbm(p + offset1), fbm(rot01 * p + offset1));
  r = vec2(fbm(rot1 * q + offset0), fbm(q + offset0));
  return fbm(p + r);
}

float digit(vec2 p) {
  vec2 grid = uGridMul * 15.0;
  vec2 s = floor(p * grid) / grid;
  p = p * grid;

  vec2 q;
  vec2 r;
  float intensity = pattern(s * 0.1, q, r) * 1.3 - 0.03;

  if (uUseMouse > 0.5) {
    vec2 mouseWorld = uMouse * uScale;
    float distToMouse = distance(s, mouseWorld);
    float mouseInfluence = exp(-distToMouse * 8.0) * uMouseStrength * 10.0;
    float ripple = sin(distToMouse * 20.0 - iTime * 5.0) * 0.1 * mouseInfluence;
    intensity += mouseInfluence + ripple;
  }

  if (uUsePageLoadAnimation > 0.5) {
    float cellRandom = fract(sin(dot(s, vec2(12.9898, 78.233))) * 43758.5453);
    float cellDelay = cellRandom * 0.8;
    float cellProgress = clamp((uPageLoadProgress - cellDelay) / 0.2, 0.0, 1.0);
    intensity *= smoothstep(0.0, 1.0, cellProgress);
  }

  p = fract(p);
  p *= uDigitSize;

  float px5 = p.x * 5.0;
  float py5 = (1.0 - p.y) * 5.0;
  float x = fract(px5);
  float y = fract(py5);

  float i = floor(py5) - 2.0;
  float j = floor(px5) - 2.0;
  float n = i * i + j * j;
  float f = n * 0.0625;

  float isOn = step(0.1, intensity - f);
  float brightness = isOn * (0.2 + y * 0.8) * (0.75 + x * 0.25);

  return step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0) * brightness;
}

float onOff(float a, float b, float c) {
  return step(c, sin(iTime + a * cos(iTime * b))) * uFlickerAmount;
}

float displace(vec2 look) {
  float y = look.y - mod(iTime * 0.25, 1.0);
  float window = 1.0 / (1.0 + 50.0 * y * y);
  return sin(look.y * 20.0 + iTime) * 0.0125 * onOff(4.0, 2.0, 0.8) * (1.0 + cos(iTime * 60.0)) * window;
}

vec3 getColor(vec2 p) {
  float bar = step(mod(p.y + time * 20.0, 1.0), 0.2) * 0.4 + 1.0;
  bar *= uScanlineIntensity;

  float displacement = displace(p);
  p.x += displacement;

  if (uGlitchAmount != 1.0) {
    float extra = displacement * (uGlitchAmount - 1.0);
    p.x += extra;
  }

  float middle = digit(p);

  const float off = 0.002;
  float sum =
    digit(p + vec2(-off, -off)) + digit(p + vec2(0.0, -off)) + digit(p + vec2(off, -off)) +
    digit(p + vec2(-off, 0.0)) + digit(p + vec2(0.0, 0.0)) + digit(p + vec2(off, 0.0)) +
    digit(p + vec2(-off, off)) + digit(p + vec2(0.0, off)) + digit(p + vec2(off, off));

  vec3 baseColor = vec3(0.9) * middle + sum * 0.1 * vec3(1.0) * bar;
  return baseColor;
}

vec2 barrel(vec2 uv) {
  vec2 c = uv * 2.0 - 1.0;
  float r2 = dot(c, c);
  c *= 1.0 + uCurvature * r2;
  return c * 0.5 + 0.5;
}

void main() {
  time = iTime * 0.333333;
  vec2 uv = vUv;

  if (uCurvature != 0.0) {
    uv = barrel(uv);
  }

  vec2 p = uv * uScale;
  vec3 col = getColor(p);

  if (uChromaticAberration != 0.0) {
    vec2 ca = vec2(uChromaticAberration) / iResolution.xy;
    col.r = getColor(p + ca).r;
    col.b = getColor(p - ca).b;
  }

  col *= uTint;
  col *= uBrightness;

  if (uDither > 0.0) {
    float rnd = hash21(gl_FragCoord.xy);
    col += (rnd - 0.5) * (uDither * 0.003922);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

export default function FaultyTerminal({
  brightness = 0.56,
  chromaticAberration = 0.45,
  className = "",
  curvature = 0.13,
  digitSize = 1.35,
  dither = 0.8,
  dpr = 1,
  flickerAmount = 0.72,
  glitchAmount = 1.52,
  gridMul = [2, 1],
  mouseReact = false,
  mouseStrength = 0.16,
  noiseAmp = 0.36,
  onFallback,
  onReady,
  pageLoadAnimation = true,
  paused = false,
  scale = 1.12,
  scanlineIntensity = 0.42,
  style,
  timeScale = 0.24,
  tint = "#d7bc72",
}: FaultyTerminalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const targetMouseRef = useRef({ x: 0.5, y: 0.5 });
  const currentMouseRef = useRef({ x: 0.5, y: 0.5 });
  const savedTimeRef = useRef(0);
  const frameIdRef = useRef(0);
  const loadStartedAtRef = useRef(0);
  const randomOffsetRef = useRef(0);
  const tintColor = useMemo(() => hexToRgb(tint), [tint]);
  const ditherValue = useMemo(() => (typeof dither === "boolean" ? (dither ? 1 : 0) : dither), [dither]);

  const handlePointerMove = useCallback((event: MouseEvent) => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    randomOffsetRef.current = Math.random() * 100;

    const rect = container.getBoundingClientRect();
    targetMouseRef.current = {
      x: (event.clientX - rect.left) / Math.max(rect.width, 1),
      y: 1 - (event.clientY - rect.top) / Math.max(rect.height, 1),
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let disposed = false;
    let renderer: Renderer | null = null;
    let canvas: HTMLCanvasElement | null = null;

    const teardown = () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }

      if (canvas && canvas.parentElement === container) {
        container.removeChild(canvas);
      }

      renderer?.gl.getExtension("WEBGL_lose_context")?.loseContext();
    };

    try {
      renderer = new Renderer({
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, dpr),
      });
    } catch (error) {
      console.warn("Faulty Terminal 背景初始化失败，已保留原背景。", error);
      onFallback?.();
      return teardown;
    }

    const { gl } = renderer;
    gl.clearColor(0, 0, 0, 1);
    canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";

    let program: Program;

    try {
      program = new Program(gl, {
        vertex: vertexShader,
        fragment: fragmentShader,
        uniforms: {
          iTime: { value: 0 },
          iResolution: { value: new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height) },
          uScale: { value: scale },
          uGridMul: { value: new Float32Array(gridMul) },
          uDigitSize: { value: digitSize },
          uScanlineIntensity: { value: scanlineIntensity },
          uGlitchAmount: { value: glitchAmount },
          uFlickerAmount: { value: flickerAmount },
          uNoiseAmp: { value: noiseAmp },
          uChromaticAberration: { value: chromaticAberration },
          uDither: { value: ditherValue },
          uCurvature: { value: curvature },
          uTint: { value: new Color(tintColor[0], tintColor[1], tintColor[2]) },
          uMouse: { value: new Float32Array([currentMouseRef.current.x, currentMouseRef.current.y]) },
          uMouseStrength: { value: mouseStrength },
          uUseMouse: { value: mouseReact ? 1 : 0 },
          uPageLoadProgress: { value: pageLoadAnimation ? 0 : 1 },
          uUsePageLoadAnimation: { value: pageLoadAnimation ? 1 : 0 },
          uBrightness: { value: brightness },
        },
      });
    } catch (error) {
      console.warn("Faulty Terminal 背景 shader 编译失败，已保留原背景。", error);
      onFallback?.();
      teardown();
      return teardown;
    }

    const geometry = new Triangle(gl);
    const mesh = new Mesh(gl, { geometry, program });
    const resizeObserver = new ResizeObserver(() => {
      if (disposed || !renderer) {
        return;
      }

      renderer.setSize(Math.max(container.offsetWidth, 1), Math.max(container.offsetHeight, 1));
      program.uniforms.iResolution.value = new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height);
    });

    const render = (time: number) => {
      if (disposed) {
        return;
      }

      frameIdRef.current = requestAnimationFrame(render);

      if (!paused) {
        const nextTime = (time * 0.001 + randomOffsetRef.current) * timeScale;
        program.uniforms.iTime.value = nextTime;
        savedTimeRef.current = nextTime;
      } else {
        program.uniforms.iTime.value = savedTimeRef.current;
      }

      if (pageLoadAnimation) {
        if (loadStartedAtRef.current === 0) {
          loadStartedAtRef.current = time;
        }

        program.uniforms.uPageLoadProgress.value = Math.min((time - loadStartedAtRef.current) / 2000, 1);
      }

      if (mouseReact) {
        const current = currentMouseRef.current;
        const target = targetMouseRef.current;
        current.x += (target.x - current.x) * 0.08;
        current.y += (target.y - current.y) * 0.08;

        const mouseUniform = program.uniforms.uMouse.value as Float32Array;
        mouseUniform[0] = current.x;
        mouseUniform[1] = current.y;
      }

      renderer?.render({ scene: mesh });
    };

    renderer.setSize(Math.max(container.offsetWidth, 1), Math.max(container.offsetHeight, 1));
    program.uniforms.iResolution.value = new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height);
    resizeObserver.observe(container);
    container.appendChild(canvas);
    if (mouseReact) {
      container.addEventListener("mousemove", handlePointerMove);
    }
    onReady?.();
    frameIdRef.current = requestAnimationFrame(render);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      if (mouseReact) {
        container.removeEventListener("mousemove", handlePointerMove);
      }
      loadStartedAtRef.current = 0;
      randomOffsetRef.current = Math.random() * 100;
      teardown();
    };
  }, [
    brightness,
    chromaticAberration,
    curvature,
    digitSize,
    ditherValue,
    dpr,
    flickerAmount,
    glitchAmount,
    gridMul,
    handlePointerMove,
    mouseReact,
    mouseStrength,
    noiseAmp,
    onFallback,
    onReady,
    pageLoadAnimation,
    paused,
    scale,
    scanlineIntensity,
    timeScale,
    tintColor,
  ]);

  return <div ref={containerRef} className={`lie-faulty-terminal-container ${className}`} style={style} />;
}
