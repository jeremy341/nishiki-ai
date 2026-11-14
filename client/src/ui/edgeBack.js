import { useEffect, useRef } from "react";

// iPhone-style "swipe back": start a touch at the left edge, drag right, and the page follows the finger.
// Let go past about a third of the screen (or with a quick flick) and it goes back; otherwise it slides home.
// Only on phones (below the md breakpoint), and only for the element behind `ref`.
export function useEdgeBack(ref, onBack, enabled = true) {
  const handler = useRef(onBack);
  handler.current = onBack;

  useEffect(() => {
    if (!enabled) return undefined;
    let startX = null;
    let startY = 0;
    let startTime = 0;
    let dx = 0;
    let active = false;
    const node = () => ref.current;

    const onStart = (event) => {
      if (window.innerWidth >= 768) return;
      const touch = event.touches[0];
      if (!touch || touch.clientX > 24) return;
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
      dx = 0;
      active = true;
      if (node()) node().style.transition = "none";
    };

    const onMove = (event) => {
      if (!active) return;
      const touch = event.touches[0];
      const moveX = touch.clientX - startX;
      const moveY = touch.clientY - startY;
      // A mostly vertical drag is a scroll, not a swipe back.
      if (dx === 0 && Math.abs(moveY) > Math.abs(moveX) && Math.abs(moveY) > 8) {
        active = false;
        return;
      }
      dx = Math.max(0, moveX);
      if (node()) node().style.transform = `translateX(${dx}px)`;
      if (event.cancelable) event.preventDefault();
    };

    const onEnd = () => {
      if (!active) return;
      active = false;
      const el = node();
      const width = window.innerWidth;
      const quick = Date.now() - startTime < 250 && dx > 60;
      if (el) el.style.transition = "transform 260ms cubic-bezier(.2,.8,.2,1)";
      if (dx > width * 0.33 || quick) {
        if (el) el.style.transform = `translateX(${width}px)`;
        window.setTimeout(() => handler.current?.(), 220);
      } else if (el) {
        el.style.transform = "";
      }
      dx = 0;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [ref, enabled]);
}
