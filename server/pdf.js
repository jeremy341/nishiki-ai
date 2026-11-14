import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PAGE_W = 595; // A4 in points
const PAGE_H = 842;
const MARGIN = 56;
const SIZE = 11;
const LEAD = 15;

// The built-in PDF fonts only cover Latin letters. Anything else is written as "?".
const safe = (text) => text.replace(/\r/g, "").replace(/\t/g, "    ")
  .replace(/[“”„]/g, '"').replace(/[‘’‚]/g, "'").replace(/[–—]/g, "-").replace(/…/g, "...").replace(/•/g, "-")
  .replace(/[^\n\x20-\x7E -ÿ€]/g, "?");

function wrap(text, font, size, maxWidth) {
  const out = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph.trim()) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
        line = candidate;
      } else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

// Builds a plain A4 document: a bold title, then the body text, with page breaks as needed.
export async function makePdf(title, body) {
  const doc = await PDFDocument.create();
  doc.setTitle(safe(title).slice(0, 200));
  doc.setCreator("Assistant");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE_W - 2 * MARGIN;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const ensureRoom = (needed) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  for (const line of wrap(safe(title), bold, 18, maxWidth)) {
    ensureRoom(26);
    page.drawText(line, { x: MARGIN, y, size: 18, font: bold, color: rgb(0.05, 0.05, 0.05) });
    y -= 26;
  }
  y -= 10;
  for (const line of wrap(safe(body), regular, SIZE, maxWidth)) {
    ensureRoom(LEAD);
    if (line) {
      page.drawText(line, { x: MARGIN, y, size: SIZE, font: regular, color: rgb(0.1, 0.1, 0.1) });
    }
    y -= LEAD;
  }
  return Buffer.from(await doc.save());
}
