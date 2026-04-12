// PDF text extraction with OCR fallback for scanned PDFs
// Strategy:
//   1. PDF.js via CDN script injection (avoids Vite/Netlify bundler issues)
//   2. If extracted text is too short → Tesseract OCR via CDN
//   3. .docx → JSZip via CDN, extract word/document.xml
//   4. .txt → FileReader

const MIN_TEXT_LENGTH = 80

const PDFJS_CDN    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
const JSZIP_CDN    = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'

// ─── Script loader (idempotent) ───────────────────────────────────────────────
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return }
    const s = document.createElement('script')
    s.src = src
    s.onload  = resolve
    s.onerror = () => reject(new Error(`No se pudo cargar: ${src}`))
    document.head.appendChild(s)
  })
}

// ─── PDF.js loader ────────────────────────────────────────────────────────────
async function getPdfJs() {
  if (!window.pdfjsLib) {
    await loadScript(PDFJS_CDN)
  }
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER
  return window.pdfjsLib
}

// ─── PDF text layer extraction ────────────────────────────────────────────────
async function extractPdfTextLayer(arrayBuffer) {
  const pdfjsLib = await getPdfJs()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''
  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p)
    const content = await page.getTextContent()
    fullText += content.items.map(i => i.str).join(' ') + '\n'
  }
  return { pdf, fullText }
}

// ─── PDF OCR fallback (scanned PDFs) ─────────────────────────────────────────
async function extractPdfWithOcr(arrayBuffer, onProgress) {
  const pdfjsLib = await getPdfJs()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  // Tesseract via CDN
  if (!window.Tesseract) {
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js')
  }

  let fullText = ''
  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.(`OCR página ${p}/${pdf.numPages}…`)
    const page     = await pdf.getPage(p)
    const viewport = page.getViewport({ scale: 2.0 })
    const canvas   = document.createElement('canvas')
    canvas.width   = viewport.width
    canvas.height  = viewport.height
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise
    const { data } = await window.Tesseract.recognize(canvas, 'spa+eng', { logger: () => {} })
    fullText += data.text + '\n'
    canvas.remove()
  }
  return fullText
}

// ─── DOCX extraction ─────────────────────────────────────────────────────────
async function extractDocxText(arrayBuffer) {
  if (!window.JSZip) {
    await loadScript(JSZIP_CDN)
  }
  const zip     = await new window.JSZip().loadAsync(arrayBuffer)
  const xmlFile = zip.file('word/document.xml')
  if (!xmlFile) return ''
  const xml = await xmlFile.async('string')
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// ─── TXT extraction ───────────────────────────────────────────────────────────
function extractTxtText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target.result)
    reader.onerror = () => reject(new Error('Error leyendo TXT'))
    reader.readAsText(file, 'UTF-8')
  })
}

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────
export async function extractText(file, onProgress) {
  const name = file.name.toLowerCase()
  onProgress?.(`Procesando ${file.name}…`)

  if (name.endsWith('.txt')) {
    return await extractTxtText(file)
  }

  const arrayBuffer = await file.arrayBuffer()

  if (name.endsWith('.docx')) {
    onProgress?.('Extrayendo texto de Word…')
    return await extractDocxText(arrayBuffer)
  }

  if (name.endsWith('.pdf')) {
    onProgress?.('Leyendo capa de texto PDF…')
    const { fullText } = await extractPdfTextLayer(arrayBuffer)
    const cleanText = fullText.replace(/\s+/g, ' ').trim()

    if (cleanText.length >= MIN_TEXT_LENGTH) {
      return cleanText
    }

    // Scanned PDF → OCR
    onProgress?.('PDF escaneado detectado — iniciando OCR…')
    const ocrText = await extractPdfWithOcr(arrayBuffer, onProgress)
    return ocrText.trim() || `[Sin texto extraíble: ${file.name}]`
  }

  return `[Formato no soportado: ${file.name}]`
}
