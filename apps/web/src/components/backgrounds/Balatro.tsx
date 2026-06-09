/**
 * ReactBits Balatro 背景：用旋涡牌桌质感的 shader 渲染全站动态底图。
 */
"use client";

import { useEffect, useRef } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";

type Vec2 = [number, number];
type Vec4 = [number, number, number, number];

export interface BalatroProps {
  className?: string;
  dpr?: number;
  onFallback?: () => void;
  onReady?: () => void;
  paused?: boolean;
  spinRotation?: number;
  spinSpeed?: number;
  offset?: Vec2;
  color1?: string;
  color2?: string;
  color3?: string;
  contrast?: number;
  lighting?: number;
  spinAmount?: number;
  pixelFilter?: number;
  spinEase?: number;
  isRotate?: boolean;
  mouseInteraction?: boolean;
  maxFps?: number;
}

function hexToVec4(hex: string): Vec4 {
  const normalized = hex.replace("#", "").padEnd(8, "f");
  const hasAlpha = normalized.length >= 8;
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  const a = hasAlpha ? parseInt(normalized.slice(6, 8), 16) / 255 : 1;
  return [r, g, b, a];
}

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform float iTime;
uniform vec3 iResolution;
uniform float uSpinRotation;
uniform float uSpinSpeed;
uniform vec2 uOffset;
uniform vec4 uColor1;
uniform vec4 uColor2;
uniform vec4 uColor3;
uniform float uContrast;
uniform float uLighting;
uniform float uSpinAmount;
uniform float uPixelFilter;
uniform float uSpinEase;
uniform float uIsRotate;
uniform vec2 uMouse;

varying vec2 vUv;

vec4 effect(vec2 screenSize, vec2 screenCoords) {
  float pixelSize = length(screenSize.xy) / uPixelFilter;
  vec2 uv = (floor(screenCoords.xy * (1.0 / pixelSize)) * pixelSize - 0.5 * screenSize.xy) / length(screenSize.xy) - uOffset;
  float uvLen = length(uv);

  float speed = (uSpinRotation * uSpinEase * 0.2);
  if (uIsRotate > 0.5) {
    speed = iTime * speed;
  }
  speed += 302.2;

  float mouseInfluence = (uMouse.x * 2.0 - 1.0);
  speed += mouseInfluence * 0.1;

  float pixelAngle = atan(uv.y, uv.x) + speed - uSpinEase * 20.0 * (uSpinAmount * uvLen + (1.0 - uSpinAmount));
  vec2 mid = (screenSize.xy / length(screenSize.xy)) / 2.0;
  uv = (vec2(uvLen * cos(pixelAngle) + mid.x, uvLen * sin(pixelAngle) + mid.y) - mid);

  uv *= 30.0;
  float baseSpeed = iTime * uSpinSpeed;
  speed = baseSpeed + mouseInfluence * 2.0;

  vec2 uv2 = vec2(uv.x + uv.y);

  for (int i = 0; i < 5; i++) {
    uv2 += sin(max(uv.x, uv.y)) + uv;
    uv += 0.5 * vec2(
      cos(5.1123314 + 0.353 * uv2.y + speed * 0.131121),
      sin(uv2.x - 0.113 * speed)
    );
    uv -= cos(uv.x + uv.y) - sin(uv.x * 0.711 - uv.y);
  }

  float contrastMod = (0.25 * uContrast + 0.5 * uSpinAmount + 1.2);
  float paintRes = min(2.0, max(0.0, length(uv) * 0.035 * contrastMod));
  float c1p = max(0.0, 1.0 - contrastMod * abs(1.0 - paintRes));
  float c2p = max(0.0, 1.0 - contrastMod * abs(paintRes));
  float c3p = 1.0 - min(1.0, c1p + c2p);
  float light = (uLighting - 0.2) * max(c1p * 5.0 - 4.0, 0.0) + uLighting * max(c2p * 5.0 - 4.0, 0.0);

  return (0.3 / uContrast) * uColor1
    + (1.0 - 0.3 / uContrast) * (uColor1 * c1p + uColor2 * c2p + vec4(c3p * uColor3.rgb, c3p * uColor1.a))
    + light;
}

void main() {
  vec2 uv = vUv * iResolution.xy;
  gl_FragColor = effect(iResolution.xy, uv);
}
`;

export default function Balatro({
  className = "",
  dpr = 1,
  onFallback,
  onReady,
  paused = false,
  spinRotation = -2,
  spinSpeed = 6.8,
  offset = [0, 0],
  color1 = "#d7bc72",
  color2 = "#2fd08f",
  color3 = "#0b1812",
  contrast = 3.2,
  lighting = 0.34,
  spinAmount = 0.22,
  pixelFilter = 820,
  spinEase = 0.95,
  isRotate = false,
  mouseInteraction = false,
  maxFps = 30,
}: BalatroProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let frameId = 0;
    let disposed = false;
    let lastFrameTime = 0;
    let renderer: Renderer | null = null;
    let canvas: HTMLCanvasElement | null = null;

    const teardown = () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }

      if (canvas && canvas.parentElement === container) {
        container.removeChild(canvas);
      }

      renderer?.gl.getExtension("WEBGL_lose_context")?.loseContext();
    };

    try {
      renderer = new Renderer({
        alpha: true,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, dpr),
      });
    } catch (error) {
      console.warn("Balatro 背景初始化失败，已切换为 CSS 动态背景。", error);
      onFallback?.();
      return teardown;
    }

    const { gl } = renderer;
    canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.opacity = "0.88";
    canvas.style.mixBlendMode = "screen";

    let program: Program;

    try {
      program = new Program(gl, {
        vertex: vertexShader,
        fragment: fragmentShader,
        uniforms: {
          iTime: { value: 0 },
          iResolution: { value: [1, 1, 1] },
          uSpinRotation: { value: spinRotation },
          uSpinSpeed: { value: spinSpeed },
          uOffset: { value: offset },
          uColor1: { value: hexToVec4(color1) },
          uColor2: { value: hexToVec4(color2) },
          uColor3: { value: hexToVec4(color3) },
          uContrast: { value: contrast },
          uLighting: { value: lighting },
          uSpinAmount: { value: spinAmount },
          uPixelFilter: { value: pixelFilter },
          uSpinEase: { value: spinEase },
          uIsRotate: { value: isRotate ? 1 : 0 },
          uMouse: { value: [0.5, 0.5] as Vec2 },
        },
      });
    } catch (error) {
      console.warn("Balatro 背景 shader 编译失败，已切换为 CSS 动态背景。", error);
      onFallback?.();
      teardown();
      return teardown;
    }

    const geometry = new Triangle(gl);
    const mesh = new Mesh(gl, { geometry, program });

    const resize = () => {
      if (!renderer || disposed) {
        return;
      }

      const width = Math.max(container.offsetWidth, 1);
      const height = Math.max(container.offsetHeight, 1);
      renderer.setSize(width, height);
      program.uniforms.iResolution.value = [gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height];
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!mouseInteraction || disposed) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = 1 - (event.clientY - rect.top) / rect.height;
      program.uniforms.uMouse.value = [x, y];
    };

    const render = (time: number) => {
      if (disposed) {
        return;
      }

      frameId = requestAnimationFrame(render);

      if (paused) {
        return;
      }

      const minFrameInterval = 1000 / maxFps;
      if (time - lastFrameTime < minFrameInterval) {
        return;
      }

      lastFrameTime = time;
      program.uniforms.iTime.value = time * 0.001;
      renderer?.render({ scene: mesh });
    };

    resize();
    window.addEventListener("resize", resize);
    container.addEventListener("pointermove", handlePointerMove);
    container.appendChild(canvas);
    onReady?.();
    frameId = requestAnimationFrame(render);

    return () => {
      disposed = true;
      window.removeEventListener("resize", resize);
      container.removeEventListener("pointermove", handlePointerMove);
      teardown();
    };
  }, [
    color1,
    color2,
    color3,
    contrast,
    dpr,
    isRotate,
    lighting,
    maxFps,
    mouseInteraction,
    offset,
    onFallback,
    onReady,
    paused,
    pixelFilter,
    spinAmount,
    spinEase,
    spinRotation,
    spinSpeed,
  ]);

  return <div ref={containerRef} className={`h-full w-full ${className}`} />;
}
