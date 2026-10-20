import * as THREE from "three";

/**
 * Canvas-backed sprite labels.
 *
 * DOM overlays inside the WebGL canvas are expensive and hard to occlude, so
 * on-globe labels are rendered as textured sprites instead. Textures are
 * cached per string and reuse the locally bundled typefaces.
 */

const cache = new Map<string, THREE.CanvasTexture>();

function cssFontFamily(variable: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim();
  return value || fallback;
}

export interface LabelOptions {
  title: string;
  subtitle?: string;
  accent?: string;
  dim?: boolean;
}

/**
 * Build (or fetch from cache) a label texture.
 * The sprite is drawn on a transparent background so it composites cleanly
 * over the globe.
 */
export function createLabelTexture(options: LabelOptions): THREE.CanvasTexture {
  const { title, subtitle, accent = "#4FE3FF", dim = false } = options;
  const key = `${title}|${subtitle ?? ""}|${accent}|${dim}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const scale = 2;
  const sans = cssFontFamily("--font-inter", "system-ui, sans-serif");
  const mono = cssFontFamily("--font-mono-jb", "ui-monospace, monospace");

  const alpha = dim ? 0.55 : 1;
  const accentColor = dim ? `${accent}` : accent;

  // Measure the text so the plate hugs the content.
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `600 30px ${sans}`;
  const titleWidth = measure.measureText(title).width;
  measure.font = `500 19px ${mono}`;
  const subtitleWidth = subtitle ? measure.measureText(subtitle).width : 0;

  const padX = 16;
  const plateH = subtitle ? 104 : 60;
  const contentWidth = Math.max(titleWidth, subtitleWidth);
  const width = Math.ceil(contentWidth + padX * 2 + 22);
  const height = subtitle ? 132 : 86;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // Backing plate
  const plateX = 4;
  const plateW = width - 12;
  const plateY = (height - plateH) / 2;

  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(4, 8, 13, 0.62)";
  roundRect(ctx, plateX, plateY, plateW, plateH, 8);
  ctx.fill();

  ctx.strokeStyle = hexToRgba(accentColor, dim ? 0.16 : 0.3);
  ctx.lineWidth = 1;
  roundRect(ctx, plateX + 0.5, plateY + 0.5, plateW - 1, plateH - 1, 8);
  ctx.stroke();

  // Accent tick
  ctx.fillStyle = accentColor;
  ctx.globalAlpha = alpha * (dim ? 0.5 : 0.95);
  ctx.fillRect(plateX + 1, plateY + 14, 2.5, plateH - 28);
  ctx.globalAlpha = alpha;

  ctx.textBaseline = "middle";
  ctx.fillStyle = dim ? "rgba(190, 205, 218, 0.9)" : "#EAF4FA";
  ctx.font = `600 30px ${sans}`;
  ctx.fillText(title, padX + 12, subtitle ? plateY + 36 : plateY + plateH / 2);

  if (subtitle) {
    ctx.font = `500 19px ${mono}`;
    ctx.fillStyle = dim ? "rgba(126, 143, 161, 0.85)" : "rgba(126, 143, 161, 0.95)";
    ctx.fillText(subtitle, padX + 12, plateY + 72);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  texture.userData.aspect = width / height;
  cache.set(key, texture);
  return texture;
}
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const num = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16
  );
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Small radial glow sprite used for satellite halos and engine plumes. */
const glowCache = new Map<string, THREE.CanvasTexture>();

export function createGlowTexture(color = "#4FE3FF", softness = 1): THREE.CanvasTexture {
  const key = `${color}|${softness}`;
  const cached = glowCache.get(key);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const c = new THREE.Color(color);
  const rgb = `${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}`;
  g.addColorStop(0, `rgba(${rgb}, 1)`);
  g.addColorStop(0.18 * softness, `rgba(${rgb}, 0.55)`);
  g.addColorStop(0.45 * softness, `rgba(${rgb}, 0.12)`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  glowCache.set(key, texture);
  return texture;
}
