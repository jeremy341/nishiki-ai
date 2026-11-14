// Touch feedback (DESIGN.md, "Touch"): a tiny haptic tick and a quiet water-drop sound. Both can be switched off in
// Settings (prefs.haptics, prefs.sounds) and the sound is made here (no sound files). Nothing here ever throws.

const flags = { haptics: true, sounds: true };

// Called with the account's preferences when they load or change.
export function configureFeedback(prefs = {}) {
  if (typeof prefs.haptics === "boolean") flags.haptics = prefs.haptics;
  if (typeof prefs.sounds === "boolean") flags.sounds = prefs.sounds;
}

const onIPhone = () => {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return /iP(hone|ad|od)/.test(ua) || (/Mac/.test(ua) && navigator.maxTouchPoints > 1);
};

let tickLabel = null;
// iPhone Safari has no vibration API, but it ticks lightly when a switch-style checkbox is toggled (iOS 17.4 and later).
// A hidden one is toggled from a tap; on other systems this does nothing.
function iosTick() {
  try {
    if (!tickLabel) {
      tickLabel = document.createElement("label");
      tickLabel.setAttribute("aria-hidden", "true");
      tickLabel.style.cssText = "position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none";
      const box = document.createElement("input");
      box.type = "checkbox";
      box.setAttribute("switch", "");
      tickLabel.appendChild(box);
      document.body.appendChild(tickLabel);
    }
    tickLabel.click();
  } catch {
    /* no haptics here */
  }
}

// kind: "tap" (a light tick), "confirm" (two ticks).
export function haptic(kind = "tap") {
  if (!flags.haptics) return;
  try {
    if (navigator.vibrate) navigator.vibrate(kind === "confirm" ? [10, 50, 12] : 8);
    else if (onIPhone()) {
      iosTick();
      if (kind === "confirm") setTimeout(iosTick, 90);
    }
  } catch {
    /* no haptics here */
  }
}

let ctx = null;
const context = () => {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
};

// The sound needs a first tap on the page before it may play; this wakes the audio up on any tap.
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", () => context()?.resume?.().catch(() => {}), { passive: true });
}

// kind: "send" (a drop falling in), "reply" (a lighter, higher drop). About 0.15 seconds, very quiet.
export function dropSound(kind = "send") {
  if (!flags.sounds) return;
  try {
    const c = context();
    if (!c || c.state !== "running") return;
    const now = c.currentTime;
    const [from, to, peak] = kind === "reply" ? [880, 520, 0.05] : [620, 340, 0.07];
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain).connect(c.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  } catch {
    /* no sound here */
  }
}
