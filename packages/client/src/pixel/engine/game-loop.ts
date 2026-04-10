export type UpdateFn = (dt: number) => void;
export type RenderFn = (ctx: CanvasRenderingContext2D) => void;

const MAX_DT = 0.1; // cap delta to prevent jumps on focus loss

export function startGameLoop(
  canvas: HTMLCanvasElement,
  update: UpdateFn,
  render: RenderFn,
): () => void {
  const ctx = canvas.getContext('2d')!;
  let lastTime = performance.now();
  let rafId: number;
  let running = true;

  function tick(now: number) {
    if (!running) return;
    const dt = Math.min((now - lastTime) / 1000, MAX_DT);
    lastTime = now;

    update(dt);

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Disable smoothing for pixel-art look
    ctx.imageSmoothingEnabled = false;

    render(ctx);

    rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  return () => {
    running = false;
    cancelAnimationFrame(rafId);
  };
}
