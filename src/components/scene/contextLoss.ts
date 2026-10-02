/**
 * Report a genuine WebGL context loss for a live canvas.
 *
 * React Three Fiber deliberately calls forceContextLoss() on a canvas it has
 * unmounted (camera reset, experiment switch). By then the canvas is detached,
 * so that intentional loss must not switch a capable device to the 2D view.
 */
export function watchContextLoss(canvas: HTMLCanvasElement, onLost: () => void) {
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    if (!canvas.isConnected) return;
    onLost();
  }, { once: true });
}
