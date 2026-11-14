// Chat mockup: draws every <svg data-orb="size"> as the dotted orb (drawOrb lives in mock.js).
document.querySelectorAll("svg[data-orb]").forEach((svg) => {
  drawOrb(svg, Number(svg.dataset.orb), { dots: Number(svg.dataset.dots || 120), base: Number(svg.dataset.base || 0.2) });
});
