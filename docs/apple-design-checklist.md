# Apple design checklist for the iPhone (and iPad) app

Goal: the app should feel native on iPhone first, then on iPad and Mac. Items marked **verify** come from secondary sources and must be checked against Apple's own documentation (developer.apple.com/design, Human Interface Guidelines) before they are treated as rules.

"Counter-bounding" is not an Apple term I could find. The closest real techniques are the spring and rubber-band motion below, and concentric corners.

## 1. Layout and safe areas

- Keep every control out of the notch, the Dynamic Island and the home indicator. Use `env(safe-area-inset-*)` on all edges, including landscape left and right. **Status:** top and bottom done; landscape sides not checked.
- Standard content margins of about 16 to 20 pt on each side. **Status:** mostly 16 px; verify.

## 2. Touch targets

- Interactive elements at least 44 × 44 pt, even when the icon is smaller. The composer tools (32 px) are below this. **Fix:** extend the hit area with padding, keep the icon size.

## 3. Corners: concentric radii

- An inner rounded element should use radius = outer radius − padding, so the two curves stay concentric. A sheet that reaches the screen edge matches the device's corner. **Status:** not systematic yet; the composer and the sheets use fixed radii.

## 4. Materials and Liquid Glass

- Floating controls (tab bars, toolbars, the composer, sheets) use translucent glass with a backdrop blur. Content does not. **Status:** the sheets and the thinking panel use glass; headers and the composer are solid. Verify how far Liquid Glass should go in iOS 26.
- Respect "Reduce Transparency" by falling back to an opaque background (`prefers-reduced-transparency`). **Status:** not done.

## 5. Sheets, popovers and modals

- Bottom sheets with a grabber, rounded top corners, a "Done" button, and detents (for example half height and full height). **Status:** done for the thinking sheet; other dialogs are centred cards.
- On iPad and Mac, a popover anchored to its button, not a full-height sheet. **Status:** done for the thinking control on desktop.

## 6. Typography

- SF Pro is the system font on iOS: SF Pro Text for small sizes, SF Pro Display for large ones (verify the 19 pt / 20 pt switch). **Status:** the app uses Geist. For iOS, the UI could use the system font stack (`-apple-system`) and keep Geist elsewhere. This is a brand decision.
- Font sizes that scale with the user's setting (Dynamic Type). On the web this is limited; check how far Safari follows the setting. **Status:** fixed pixel sizes.
- Inputs at 16 px or more, so iOS does not zoom on focus. **Status:** done on phones.

## 7. Motion

- Springs rather than linear easing. Our curves approximate a spring with `cubic-bezier(.34,1.25,.64,1)`. A real spring needs a motion library (for example Framer Motion) for a closer match.
- Rubber-band stretch at the end of a scroll (`overscroll-behavior` on lists, and a bounce where it fits).
- Respect "Reduce Motion": turn off the springs and the slide-in animations. **Status:** not done. Add `@media (prefers-reduced-motion: reduce)`.

## 8. Feedback

- Pressed state on every tappable element (opacity or a background change). **Status:** partly done.
- Haptics on selection and on success. Safari on iPhone does not expose haptics to web pages. In a native wrapper (Capacitor) the haptics plugin can do it. **Status:** Android vibration only.

## 9. Navigation

- Large titles that collapse on scroll, a back chevron, and the edge swipe to go back. The edge swipe needs a native wrapper or a careful history implementation. **Status:** FullPage with a back button; no edge swipe.

## 10. Icons and colour

- SF Symbols are the native icon set; we use Lucide, which looks similar but is not identical. Verify the visual weight.
- System colours: the iOS blue is used for the slider and for "Done" (`#0A84FF` dark, `#007AFF` light). **Status:** done.

## 11. Launch and home screen

- Icons: 180 × 180 for the home screen, 192 and 512 for the manifest, a maskable icon for Android. **Status:** done.
- Launch screens (`apple-touch-startup-image`) for each device size. **Status:** not done.
- Status bar: `black-translucent`, so the content runs under the status bar. **Status:** done.

## 12. Accessibility

- VoiceOver labels on every control. **Status:** mostly done.
- Contrast and Dynamic Type. Test with the Accessibility Inspector on a Mac.

## How to check this

1. On an iPhone, run the app from the home screen (not in Safari) and go through every screen.
2. Use Safari's Web Inspector from a Mac for layout and safe-area checks.
3. Use the iOS Simulator (Xcode) for the closest look, once there is a native wrapper.
