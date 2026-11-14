import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import { AppError } from "./errors.js";

// PowerPoint files: building a deck from a title and slides, and reading the text of an existing deck.

const INK = "1A1A1A";
const MUTED = "5A5A5A";

// Builds a 16:9 deck: a title slide, then one slide per entry, each with bullet points.
export async function makePresentation(title, slides) {
  const deck = new PptxGenJS();
  deck.layout = "LAYOUT_WIDE";
  deck.title = title;
  deck.author = "Nishiki";

  const cover = deck.addSlide();
  cover.background = { color: "FFFFFF" };
  cover.addText(title, { x: 0.8, y: 2.6, w: 11.7, h: 1.6, fontFace: "Arial", fontSize: 44, bold: true, color: INK });

  for (const slide of slides) {
    const page = deck.addSlide();
    page.background = { color: "FFFFFF" };
    page.addText(slide.title, { x: 0.8, y: 0.6, w: 11.7, h: 1.0, fontFace: "Arial", fontSize: 30, bold: true, color: INK });
    if (slide.bullets?.length) {
      page.addText(
        slide.bullets.map((b) => ({ text: b, options: { bullet: true, breakLine: true } })),
        { x: 0.9, y: 1.9, w: 11.5, h: 4.9, fontFace: "Arial", fontSize: 22, color: MUTED, valign: "top", paraSpaceAfter: 10 },
      );
    }
  }
  return Buffer.from(await deck.write({ outputType: "nodebuffer" }));
}

const decodeXml = (s) => s
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&amp;/g, "&");

// The text of every slide, as "Folie N:" followed by its lines. Used for the model and the viewer.
export async function slidesText(data) {
  let zip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new AppError(400, "That PowerPoint file could not be read.");
  }
  const names = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)[1]) - Number(b.match(/(\d+)\.xml$/)[1]));
  const parts = [];
  for (let i = 0; i < names.length; i += 1) {
    const xml = await zip.file(names[i]).async("string");
    const lines = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodeXml(m[1])).filter(Boolean);
    parts.push(`Folie ${i + 1}:\n${lines.join("\n")}`);
  }
  return parts.join("\n\n").slice(0, 60000);
}
