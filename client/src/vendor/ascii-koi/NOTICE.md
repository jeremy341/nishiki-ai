# ASCII Koi (vendored)

`pond.js` and `pond.css` are taken from https://github.com/pursurer/ascii-koi (MIT License, see `LICENSE`).
The only change: the monospace font name in `pond.js` also lists the app's bundled "Geist Mono Variable" face.
The rest of the stylesheet is not used; the colours come from the hero section's own tokens in `client/src/Hero.jsx`.

Second change (2026-11): `dim()` may return an array of clearings (rectangles or circles with their own fade distance), `opts.count` fixes the number of koi, and open-water marks fade inside clearings too. Everything else is the original engine. The change is made by `docs/mockups/make-pond-multi.mjs` from the original file.
