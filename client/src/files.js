import { t } from "./i18n/index.js";
// Turns a picked file into what the server accepts: photos are resized to JPEG, everything else
// is sent as it is. Everything goes out as base64 JSON.
import { api } from "./api.js";

export const MAX_BYTES = 6 * 1024 * 1024;

// The file types the app reads. Browsers often leave the type empty or wrong (for example CSV on Windows),
// so the extension decides when the type is not reliable.
const BY_EXTENSION = {
  pdf: "application/pdf",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  json: "application/json",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

export const PICKER_ACCEPT = [
  "application/pdf", "image/*", ".csv", ".txt", ".md", ".json", ".docx", ".pptx",
].join(",");

export function mimeFor(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  const fromExt = BY_EXTENSION[ext];
  if (fromExt && (!file.type || file.type === "application/octet-stream" || file.type === "application/vnd.ms-excel")) {
    return fromExt;
  }
  return file.type || fromExt || "application/octet-stream";
}

// "image", "pdf", "csv", "docx", "pptx", "text" or "other": what the chip and the viewer show.
export function kindFor(file) {
  const mime = mimeFor(file);
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime === "text/csv") return "csv";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "pptx";
  if (mime.startsWith("text/") || mime === "application/json") return "text";
  return "other";
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function shrinkImage(file, maxSide = 1600) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; // transparent PNGs would otherwise turn black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  return blob;
}

// Uploads one file and resolves to { id, kind, name, mime, size }.
export async function uploadFile(file) {
  const mime0 = mimeFor(file);
  let blob = file;
  let mime = mime0;
  if (mime0.startsWith("image/") && mime0 !== "image/gif") {
    const shrunk = await shrinkImage(file);
    if (shrunk) {
      blob = shrunk;
      mime = "image/jpeg";
    }
  }
  if (blob.size > MAX_BYTES) throw new Error(t("That file is too large (max 6 MB)."));
  const base64 = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
  const name = file.name || (mime === "image/jpeg" ? "photo.jpg" : "file");
  const data = await api("/api/attachments", { method: "POST", body: { name, mime, data: base64 } });
  return data.attachment;
}
