import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

type Vec3 = readonly [number, number, number];
export type LabelTone = 'navy' | 'light' | 'blue' | 'vapour';
const TONES: Record<LabelTone, { fill: string; stroke: string; title: string; subtitle: string; dashed?: boolean }> = {
  navy: { fill: 'rgba(22,66,108,0.88)', stroke: 'rgba(255,255,255,0.75)', title: '#ffffff', subtitle: '#cfe6f7' },
  light: { fill: 'rgba(255,255,255,0.96)', stroke: '#a9d3ee', title: '#17436a', subtitle: '#4c6c8c' },
  blue: { fill: 'rgba(255,255,255,0.97)', stroke: '#8fbdea', title: '#1e5fb0', subtitle: '#4c6c8c' },
  vapour: { fill: 'rgba(255,255,255,0.92)', stroke: '#c8736f', title: '#6b3a39', subtitle: '#8a5a58', dashed: true },
};

/**
 * A crisp text label that is drawn into a canvas texture and shown as a screen-constant sprite (so it stays
 * readable at any zoom and works with no DOM overlay). `pointer` draws a small tail whose tip sits on `position`.
 */
export function SceneLabel({ position, title, subtitle, tone = 'light', pointer = null, zoom = 1, renderOrder = 30 }: {
  position: Vec3; title: string; subtitle?: string; tone?: LabelTone; pointer?: 'down' | 'up' | 'right' | null; zoom?: number; renderOrder?: number;
}) {
  const viewportHeight = useThree((state) => state.size.height);
  const narrow = useThree((state) => state.size.width < 520);
  const made = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const ratio = 3;
    const tail = pointer ? 7 : 0;
    const titleSize = subtitle ? 12.5 : 12, subtitleSize = 10.5;
    const measure = document.createElement('canvas').getContext('2d'); if (!measure) return null;
    measure.font = `600 ${titleSize * ratio}px Lexend, system-ui, sans-serif`;
    const titleWidth = measure.measureText(title).width;
    measure.font = `500 ${subtitleSize * ratio}px Lexend, system-ui, sans-serif`;
    const subtitleWidth = subtitle ? measure.measureText(subtitle).width : 0;
    const padX = 10 * ratio, padY = 5 * ratio;
    const bodyWidth = Math.ceil(Math.max(titleWidth, subtitleWidth) + padX * 2);
    const bodyHeight = Math.ceil((subtitle ? titleSize + subtitleSize + 5 : titleSize + 3) * ratio + padY * 2);
    const canvas = document.createElement('canvas');
    canvas.width = bodyWidth + (pointer === 'right' ? tail * ratio : 0) + 4; canvas.height = bodyHeight + (pointer === 'down' || pointer === 'up' ? tail * ratio : 0) + 4;
    const context = canvas.getContext('2d'); if (!context) return null;
    const style = TONES[tone];
    const x0 = 2, y0 = 2 + (pointer === 'up' ? tail * ratio : 0), radius = 11 * ratio;
    context.beginPath();
    context.roundRect(x0, y0, bodyWidth, bodyHeight, radius);
    context.fillStyle = style.fill; context.fill();
    context.lineWidth = 1.3 * ratio; context.strokeStyle = style.stroke;
    if (style.dashed) context.setLineDash([4 * ratio, 3 * ratio]);
    context.stroke(); context.setLineDash([]);
    if (pointer) {
      context.beginPath();
      if (pointer === 'down') { const cx = x0 + bodyWidth / 2; context.moveTo(cx - 5 * ratio, y0 + bodyHeight - 1); context.lineTo(cx, y0 + bodyHeight + tail * ratio); context.lineTo(cx + 5 * ratio, y0 + bodyHeight - 1); }
      else if (pointer === 'up') { const cx = x0 + bodyWidth / 2; context.moveTo(cx - 5 * ratio, y0 + 1); context.lineTo(cx, y0 - tail * ratio); context.lineTo(cx + 5 * ratio, y0 + 1); }
      else { const cy = y0 + bodyHeight / 2; context.moveTo(x0 + bodyWidth - 1, cy - 5 * ratio); context.lineTo(x0 + bodyWidth + tail * ratio, cy); context.lineTo(x0 + bodyWidth - 1, cy + 5 * ratio); }
      context.closePath(); context.fillStyle = style.fill; context.fill();
    }
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.font = `600 ${titleSize * ratio}px Lexend, system-ui, sans-serif`; context.fillStyle = style.title;
    context.fillText(title, x0 + bodyWidth / 2, y0 + padY + (titleSize * ratio) / 2 + (subtitle ? 0 : 1));
    if (subtitle) {
      context.font = `500 ${subtitleSize * ratio}px Lexend, system-ui, sans-serif`; context.fillStyle = style.subtitle;
      context.fillText(subtitle, x0 + bodyWidth / 2, y0 + padY + titleSize * ratio + 5 * ratio + (subtitleSize * ratio) / 2 - 3);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    return { texture, aspect: canvas.width / canvas.height, cssHeight: canvas.height / ratio };
  }, [pointer, subtitle, title, tone]);
  useEffect(() => () => made?.texture.dispose(), [made]);
  if (!made) return null;
  const height = ((made.cssHeight * zoom * (narrow ? 0.78 : 1)) / Math.max(1, viewportHeight)) * 0.6498;
  const centre: [number, number] = pointer === 'down' ? [0.5, 0] : pointer === 'up' ? [0.5, 1] : pointer === 'right' ? [1, 0.5] : [0.5, 0.5];
  return <sprite position={[...position]} scale={[height * made.aspect, height, 1]} center={centre} renderOrder={renderOrder}>
    <spriteMaterial map={made.texture} transparent depthTest={false} depthWrite={false} sizeAttenuation={false} toneMapped={false} />
  </sprite>;
}
