// The look of the app is always the koi pond look. Settings no longer offers another one.
// The functions below stay so that the rest of the app can ask for the look the same way as before.

const KOI = "koi";

export function getStyle() {
  return KOI;
}

export function setStyle() {
  document.documentElement.dataset.style = KOI;
}

export function useStyle() {
  return KOI;
}

document.documentElement.dataset.style = KOI;
