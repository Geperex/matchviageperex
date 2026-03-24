// PDF text extraction with OCR fallback for scanned PDFs
// Strategy:
//   1. Try PDF.js text layer (fast, accurate for digital PDFs)
//   2. If extracted text is too short/empty → render page as canvas → Tesseract OCR
//   3. .docx → read as ZIP, extract word/document.xml text nodes
//   4. .txt → direct FileReader

const MIN_TEXT_LENGTH = 80; // threshold to decide if OCR is needed

// ─── PDF.js ──────────────────────────────────────────────────────────────────
async function getPdfJs() {
  const pdfjsLib = await import("pdfjs-dist");
  // Worker via CDN to avoid bundler issues
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs";
  return pdfjsLib;
}

async function extractPdfTextLayer(arrayBuffer) {
  const pdfjsLib = await getPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items.map((i) => i.str).join(" ");
    fullText += pageText + "\n";
  }
  return { pdf, fullText };
}

async function extractPdfWithOcr(arrayBuffer, onProgress) {
  const pdfjsLib = await getPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Lazy-load Tesseract only when needed
  const Tesseract = (await import("tesseract.js")).default;

  let fullText = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.(`OCR página ${p}/${pdf.numPages}…`);
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2.0 }); // higher = better OCR
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;

    const { data } = await Tesseract.recognize(canvas, "spa+eng", {
      logger: () => {},
    });
    fullText += data.text + "\n";
    canvas.remove();
  }
  return fullText;
}

// ─── DOCX ────────────────────────────────────────────────────────────────────
async function extractDocxText(arrayBuffer) {
  // DOCX = ZIP with word/document.xml inside
  const { default: JSZip } = await import(
    "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"
  );
  const zip = await JSZip.loadAsync(arrayBuffer);
  const xmlFile = zip.file("word/document.xml");
  if (!xmlFile) return "";
  const xml = await xmlFile.async("string");
  // Strip XML tags, keep text content
  return xml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── TXT ─────────────────────────────────────────────────────────────────────
function extractTxtText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Error leyendo TXT"));
    reader.readAsText(file, "UTF-8");
  });
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export async function extractText(file, onProgress) {
  const name = file.name.toLowerCase();
  onProgress?.(`Procesando ${file.name}…`);

  if (name.endsWith(".txt")) {
    return await extractTxtText(file);
  }

  const arrayBuffer = await file.arrayBuffer();

  if (name.endsWith(".docx")) {
    onProgress?.("Extrayendo texto de Word…");
    return await extractDocxText(arrayBuffer);
  }

  if (name.endsWith(".pdf")) {
    onProgress?.("Leyendo capa de texto PDF…");
    const { pdf, fullText } = await extractPdfTextLayer(arrayBuffer);

    const cleanText = fullText.replace(/\s+/g, " ").trim();

    if (cleanText.length >= MIN_TEXT_LENGTH) {
      // Digital PDF — text layer is good
      return cleanText;
    }

    // Scanned PDF — fall back to OCR
    onProgress?.("PDF escaneado detectado — iniciando OCR…");
    const ocrText = await extractPdfWithOcr(arrayBuffer, onProgress);
    return ocrText.trim() || `[Sin texto extraíble: ${file.name}]`;
  }

  return `[Formato no soportado: ${file.name}]`;
}
