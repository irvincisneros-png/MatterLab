import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';

/**
 * Keeps 3D scenes usable on classroom Chromebooks:
 *  - drops the pixel ratio to 1 when the frame rate falls, and restores it when it recovers;
 *  - stops drawing while the canvas is scrolled out of view (model clocks run outside the
 *    renderer, so simulations keep advancing; only the picture pauses).
 */
export function AdaptiveQuality({ maxDpr = 1.6 }: { maxDpr?: number }) {
  const gl = useThree((state) => state.gl);
  const setDpr = useThree((state) => state.setDpr);
  const setFrameloop = useThree((state) => state.setFrameloop);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setFrameloop(entry.isIntersecting ? 'always' : 'never'));
    observer.observe(gl.domElement);
    return () => { observer.disconnect(); setFrameloop('always'); };
  }, [gl, setFrameloop]);
  const best = () => Math.min(maxDpr, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  return <PerformanceMonitor flipflops={3} onDecline={() => setDpr(1)} onIncline={() => setDpr(best())} onFallback={() => setDpr(1)} />;
}
