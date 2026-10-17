const STORAGE_KEY = "vestflow-first-collect-celebrated";

export function celebrateFirstCollect(): boolean {
  if (typeof window === "undefined") return false;

  try {
    if (window.localStorage.getItem(STORAGE_KEY)) return false;
    window.localStorage.setItem(STORAGE_KEY, "true");
  } catch {
    return false;
  }

  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return false;
  }

  void import("canvas-confetti")
    .then(({ default: confetti }) => {
      const end = Date.now() + 2500;
      const tick = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 60,
          origin: { x: 0 },
          zIndex: 9999,
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 60,
          origin: { x: 1 },
          zIndex: 9999,
        });
        if (Date.now() < end) window.requestAnimationFrame(tick);
      };
      tick();
    })
    .catch(() => {});

  return true;
}
