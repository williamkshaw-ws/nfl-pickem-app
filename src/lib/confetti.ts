import confetti from "canvas-confetti";

let mainThreadConfetti: ReturnType<typeof confetti.create> | null = null;

function getMainThreadConfetti() {
  if (typeof window === "undefined") return null;
  if (!mainThreadConfetti) {
    try {
      const createFn =
        typeof confetti.create === "function"
          ? confetti.create
          : (confetti as any)?.default?.create;

      if (typeof createFn === "function") {
        mainThreadConfetti = createFn(null, {
          resize: true,
          useWorker: false,
          disableForReducedMotion: false,
        });
      }
    } catch (e) {
      console.warn("Failed to create main-thread confetti cannon:", e);
    }
  }
  return mainThreadConfetti;
}

/**
 * DOM fallback confetti particles using lightweight CSS animations
 * if canvas is unavailable or blocked.
 */
function launchDomConfetti() {
  if (typeof document === "undefined") return;

  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  container.style.cssText =
    "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 999999; overflow: hidden;";

  const colors = ["#10b981", "#f59e0b", "#6366f1", "#ec4899", "#3b82f6", "#14b8a6", "#e11d48", "#8b5cf6"];
  const count = 65;

  for (let i = 0; i < count; i++) {
    const el = document.createElement("div");
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.floor(Math.random() * 8) + 8;
    const startX = Math.random() * 100;
    const endX = startX + (Math.random() * 30 - 15);
    const duration = 2.2 + Math.random() * 1.5;
    const delay = Math.random() * 0.4;
    const isCircle = Math.random() > 0.5;

    el.style.cssText = `
      position: absolute;
      top: -20px;
      left: ${startX}vw;
      width: ${size}px;
      height: ${isCircle ? size : size * 0.6}px;
      background: ${color};
      border-radius: ${isCircle ? "50%" : "2px"};
      opacity: 0.95;
      transform: translateY(0) rotate(0deg);
      transition: transform ${duration}s cubic-bezier(0.25, 1, 0.5, 1), opacity ${duration}s ease-out;
      transition-delay: ${delay}s;
    `;
    container.appendChild(el);

    // Trigger falling transition on next tick
    setTimeout(() => {
      const rotation = Math.random() * 720 - 360;
      el.style.transform = `translate(${endX - startX}vw, calc(105vh)) rotate(${rotation}deg)`;
      setTimeout(() => {
        el.style.opacity = "0";
      }, (duration + delay - 0.6) * 1000);
    }, 20);
  }

  document.body.appendChild(container);
  setTimeout(() => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  }, 4500);
}

/**
 * Fires celebration confetti guaranteed across all browsers and devices.
 * Uses canvas-confetti on the main thread (bypassing CSP/Blob worker issues),
 * with immediate bursts, side cannons, and DOM fallbacks.
 */
export function fireCelebrationConfetti() {
  if (typeof window === "undefined") return;

  let canvasSucceeded = false;
  const cannon = getMainThreadConfetti();

  const confettiFn =
    cannon ||
    (typeof confetti === "function" ? confetti : (confetti as any)?.default);

  if (typeof confettiFn === "function") {
    try {
      // 1. Center burst
      confettiFn({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
        zIndex: 999999,
        disableForReducedMotion: false,
        colors: ["#10b981", "#f59e0b", "#6366f1", "#ec4899", "#3b82f6", "#14b8a6", "#fbbf24"],
      });
      canvasSucceeded = true;

      // 2. Left and right cannons with a slight staggered delay
      setTimeout(() => {
        try {
          confettiFn({
            particleCount: 50,
            angle: 60,
            spread: 60,
            origin: { x: 0.05, y: 0.7 },
            zIndex: 999999,
            disableForReducedMotion: false,
            colors: ["#10b981", "#f59e0b", "#6366f1", "#ec4899", "#3b82f6"],
          });
          confettiFn({
            particleCount: 50,
            angle: 120,
            spread: 60,
            origin: { x: 0.95, y: 0.7 },
            zIndex: 999999,
            disableForReducedMotion: false,
            colors: ["#10b981", "#f59e0b", "#6366f1", "#ec4899", "#3b82f6"],
          });
        } catch {}
      }, 180);
    } catch (err) {
      console.warn("Canvas confetti execution error:", err);
      canvasSucceeded = false;
    }
  }

  // Also trigger DOM confetti fallback to ensure visible celebration everywhere
  try {
    launchDomConfetti();
  } catch (err) {
    console.warn("DOM confetti error:", err);
  }
}
