import { useState, useRef, useCallback } from 'react'
import { extractText } from './extractor.js'

// ─── constants ────────────────────────────────────────────────────────────────
const MODES = [
  { id: 'profile',      label: 'Análisis de Perfil',       cost: 2 },
  { id: 'competencies', label: 'Análisis de Competencias',  cost: 2 },
  { id: 'full',         label: 'Análisis 100% Global',      cost: 3 },
]

const SYSTEM_PROMPT = `Eres un experto en selección de personas para sectores de alta exigencia en Chile (Minería, Energía, Sector Público).
Analiza CVs versus un perfil de puesto y responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin backticks.
Estructura exacta requerida:
{
  "candidates": [
    {
      "name": "Nombre del candidato (extráelo del CV; si no aparece, usa el nombre del archivo sin extensión)",
      "fileName": "archivo.pdf",
      "score": 85,
      "summary": "Análisis de 2-3 oraciones sobre compatibilidad con el cargo",
      "strengths": ["fortaleza 1", "fortaleza 2", "fortaleza 3"],
      "gaps": ["brecha 1", "brecha 2"],
      "competencies": {
        "Experiencia Técnica": 80,
        "Liderazgo": 70,
        "Adaptabilidad": 85,
        "Trabajo en Equipo": 90,
        "Formación Académica": 75
      }
    }
  ]
}
score de 0–100. Competencias de 0–100. Ordena candidatos por score descendente. Solo JSON, nada más.`

// ─── helpers ──────────────────────────────────────────────────────────────────
const sc = v => v >= 75 ? 'var(--green)' : v >= 50 ? 'var(--gold)' : 'var(--red)'

function RankPill({ idx }) {
  const cfg = [
    { label: '🥇 1° Lugar', bg: '#f59e0b1e', color: '#f59e0b', border: '#f59e0b3a' },
    { label: '🥈 2° Lugar', bg: '#94a3b81e', color: '#94a3b8', border: '#94a3b83a' },
    { label: '🥉 3° Lugar', bg: '#92400e1e', color: '#cd8b45', border: '#92400e3a' },
  ][idx] || { label: `# ${idx + 1}`, bg: '#23283640', color: 'var(--dim)', border: 'var(--border)' }
  return (
    <span style={{
      display: 'inline-block',
      fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 11,
      padding: '3px 10px', borderRadius: 100, letterSpacing: 1,
      textTransform: 'uppercase', marginBottom: 6,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>{cfg.label}</span>
  )
}

// ─── CandidateCard ────────────────────────────────────────────────────────────
function CandidateCard({ candidate: c, idx, mode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="slide-in" style={{
      animationDelay: `${idx * 0.07}s`,
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--rl)', padding: '22px 26px',
      borderLeft: idx === 0 ? '3px solid var(--gold)' : idx === 1 ? '3px solid #94a3b8' : idx === 2 ? '3px solid #cd8b45' : '1px solid var(--border)',
    }}>
      {/* top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <RankPill idx={idx} />
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: -.3 }}>{c.name || 'Candidato'}</div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>{c.fileName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 32, letterSpacing: -2, lineHeight: 1, color: sc(c.score) }}>{c.score}</div>
          <div style={{ fontSize: 11, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: .5 }}>/ 100</div>
        </div>
      </div>

      {/* score bar */}
      <div style={{ height: 5, background: 'var(--surface2)', borderRadius: 100, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ height: '100%', borderRadius: 100, width: `${c.score}%`, background: 'linear-gradient(90deg,#2563eb,#38bdf8)', transition: 'width 1.1s ease' }} />
      </div>

      {/* toggle details */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12, fontFamily: "'DM Sans',sans-serif", marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}
      >
        {open ? '▾' : '▸'} {open ? 'Ocultar detalle' : 'Ver detalle'}
      </button>

      {open && <>
        {/* strengths */}
        {c.strengths?.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: .5, fontWeight: 500, marginBottom: 5 }}>Fortalezas</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {c.strengths.map((s, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 100, background: '#10b98112', border: '1px solid #10b98128', color: 'var(--green)' }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* gaps */}
        {c.gaps?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: .5, fontWeight: 500, marginBottom: 5 }}>Brechas</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {c.gaps.map((g, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 100, background: '#ef444412', border: '1px solid #ef444428', color: 'var(--red)' }}>{g}</span>
              ))}
            </div>
          </div>
        )}

        {/* competencies */}
        {mode !== 'profile' && c.competencies && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(155px,1fr))', gap: 6, marginBottom: 11 }}>
            {Object.entries(c.competencies).map(([k, v]) => (
              <div key={k} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 11px' }}>
                <div style={{ fontSize: 10, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 3, fontWeight: 500 }}>{k}</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, color: sc(v) }}>{v}%</div>
              </div>
            ))}
          </div>
        )}

        {/* summary */}
        {c.summary && (
          <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--muted)', background: 'var(--surface2)', borderRadius: 'var(--r)', padding: '12px 14px', border: '1px solid var(--border)', marginTop: 4 }}>
            {c.summary}
          </div>
        )}
      </>}
    </div>
  )
}

// ─── DropZone ─────────────────────────────────────────────────────────────────
function DropZone({ icon, label, hint, multiple, onFiles, inputRef }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files) }}
      style={{
        border: `1.5px dashed ${over ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--r)', padding: '20px 14px', textAlign: 'center',
        cursor: 'pointer', background: over ? '#2563eb09' : '#ffffff03',
        transition: 'all .2s', position: 'relative',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".txt,.pdf,.docx"
        multiple={multiple}
        onChange={e => onFiles(e.target.files)}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
      />
      <div style={{ fontSize: 26, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>
        <strong style={{ color: 'var(--accent2)', fontWeight: 600 }}>{label}</strong>
      </div>
      <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 3 }}>{hint}</div>
    </div>
  )
}

// ─── FileItem ─────────────────────────────────────────────────────────────────
function FileItem({ name, status, onRemove }) {
  const color = status === 'ready' ? 'var(--green)' : status === 'ocr' ? 'var(--gold)' : status === 'error' ? 'var(--red)' : 'var(--muted)'
  const icon  = status === 'ready' ? '✓' : status === 'ocr' ? '⟳' : status === 'error' ? '✗' : '…'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 12 }}>
      <span style={{ color, fontSize: 13 }}>{icon}</span>
      <span style={{ flex: 1, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
      {onRemove && <span onClick={onRemove} style={{ cursor: 'pointer', color: 'var(--dim)', fontSize: 17, lineHeight: 1, transition: 'color .2s' }} onMouseOver={e => e.target.style.color='var(--red)'} onMouseOut={e => e.target.style.color='var(--dim)'}>×</span>}
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [credits, setCredits]     = useState(20)
  const [jobFile, setJobFile]     = useState(null)   // { name, content, status }
  const [cvFiles, setCvFiles]     = useState([])     // [{ name, content, status }]
  const [mode, setMode]           = useState('profile')
  const [loading, setLoading]     = useState(false)
  const [loadMsg, setLoadMsg]     = useState('')
  const [results, setResults]     = useState(null)
  const [error, setError]         = useState('')
  const [modal, setModal]         = useState(false)
  const [toast, setToast]         = useState(null)
  const jobRef = useRef()
  const cvRef  = useRef()

  function notify(icon, msg, type = 's') {
    setToast({ icon, msg, type })
    setTimeout(() => setToast(null), 3200)
  }

  // ── load job file ────────────────────────────────────────────────────────────
  async function handleJobFiles(fileList) {
    const file = fileList[0]
    if (!file) return
    setJobFile({ name: file.name, content: '', status: 'loading' })
    try {
      const content = await extractText(file, msg => setLoadMsg(msg))
      setJobFile({ name: file.name, content, status: 'ready' })
      notify('✓', `Perfil cargado (${content.length} caracteres)`)
    } catch (e) {
      setJobFile({ name: file.name, content: '', status: 'error' })
      notify('✗', `Error al leer: ${e.message}`, 'e')
    }
  }

  // ── load CV files ────────────────────────────────────────────────────────────
  async function handleCvFiles(fileList) {
    const files = Array.from(fileList)
    if (!files.length) return

    const placeholders = files.map(f => ({ name: f.name, content: '', status: 'loading' }))
    setCvFiles(prev => [...prev, ...placeholders])
    const baseIdx = cvFiles.length

    await Promise.all(files.map(async (file, i) => {
      try {
        const content = await extractText(file, msg => {
          setLoadMsg(msg)
          setCvFiles(prev => {
            const next = [...prev]
            next[baseIdx + i] = { ...next[baseIdx + i], status: 'ocr' }
            return next
          })
        })
        setCvFiles(prev => {
          const next = [...prev]
          next[baseIdx + i] = { name: file.name, content, status: 'ready' }
          return next
        })
      } catch (e) {
        setCvFiles(prev => {
          const next = [...prev]
          next[baseIdx + i] = { name: file.name, content: '', status: 'error' }
          return next
        })
      }
    }))

    notify('✓', `${files.length} CV(s) procesado(s)`)
  }

  function removeCV(idx) {
    setCvFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const costPerCV  = MODES.find(m => m.id === mode)?.cost || 2
  const totalCost  = costPerCV * cvFiles.filter(f => f.status === 'ready').length
  const canAnalyze = jobFile?.status === 'ready' && cvFiles.some(f => f.status === 'ready') && !loading

  // ── analyze ──────────────────────────────────────────────────────────────────
  async function analyze() {
    setError('')
    if (credits < totalCost) { notify('⚠', `Necesitas ${totalCost} créditos`, 'e'); return }

    setLoading(true)
    setResults(null)
    const mLabel = MODES.find(m2 => m2.id === mode)?.label
    const ready  = cvFiles.filter(f => f.status === 'ready')

    let prompt = `PERFIL DEL PUESTO (${jobFile.name}):\n${jobFile.content.slice(0, 4000)}\n\nMODO: ${mLabel}\n\n`
    ready.forEach((cv, i) => {
      prompt += `--- CV ${i + 1}: ${cv.name} ---\n${cv.content.slice(0, 3000)}\n\n`
    })
    if (mode === 'profile')      prompt += 'Enfócate en compatibilidad general con el perfil.'
    else if (mode === 'competencies') prompt += 'Enfócate en análisis detallado de competencias técnicas y conductuales.'
    else                          prompt += 'Análisis global completo: compatibilidad, competencias, fortalezas y brechas.'

    setLoadMsg(`Analizando ${ready.length} candidato(s) con IA…`)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: prompt }],
        }),
      })

      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e?.error?.message || `HTTP ${res.status}`)
      }

      const data = await res.json()
      const raw  = data.content?.map(b => b.text || '').join('') || ''
      const clean = raw.replace(/```json|```/g, '').trim()

      let parsed
      try { parsed = JSON.parse(clean) }
      catch {
        const m = clean.match(/\{[\s\S]*\}/)
        if (m) parsed = JSON.parse(m[0])
        else throw new Error('No se pudo interpretar la respuesta de la IA.')
      }

      setResults({ candidates: parsed.candidates || [], mode })
      setCredits(c => c - totalCost)
      notify('✓', `Análisis completado · ${totalCost} créditos usados`)
    } catch (err) {
      setError(err.message)
      notify('✗', 'Error en el análisis', 'e')
    } finally {
      setLoading(false)
      setLoadMsg('')
    }
  }

  function reset() {
    setJobFile(null); setCvFiles([]); setResults(null); setError('')
    if (jobRef.current) jobRef.current.value = ''
    if (cvRef.current)  cvRef.current.value  = ''
    notify('↺', 'Búsqueda reiniciada')
  }

  // ── render ────────────────────────────────────────────────────────────────────
  const S = {
    app: {
      minHeight: '100vh', background: 'var(--bg)',
      backgroundImage: 'radial-gradient(ellipse 65% 50% at 80% 5%,#2563eb18 0%,transparent 60%),radial-gradient(ellipse 45% 40% at 10% 85%,#818cf818 0%,transparent 50%)',
    },
    gridBg: {
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
      backgroundImage: 'linear-gradient(#23283618 1px,transparent 1px),linear-gradient(90deg,#23283618 1px,transparent 1px)',
      backgroundSize: '40px 40px',
    },
    header: {
      position: 'sticky', top: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '15px 32px', borderBottom: '1px solid var(--border)',
      background: 'rgba(10,12,16,.88)', backdropFilter: 'blur(14px)',
    },
    main: { position: 'relative', zIndex: 5, maxWidth: 1060, margin: '0 auto', padding: '40px 18px 80px' },
    card: {
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--rl)', padding: 22,
    },
    btn: (variant) => ({
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '9px 17px', borderRadius: 'var(--r)',
      fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13,
      cursor: 'pointer', border: 'none', transition: 'all .2s',
      ...(variant === 'primary' ? {
        background: 'linear-gradient(135deg,#2563eb,#818cf8)', color: '#fff',
        boxShadow: '0 4px 16px #2563eb2e', opacity: 1,
      } : variant === 'ghost' ? {
        background: 'var(--surface2)', color: 'var(--muted)',
        border: '1px solid var(--border)',
      } : {
        background: 'transparent', color: 'var(--gold)',
        border: '1px solid #f59e0b42',
      })
    }),
  }

  return (
    <>
      <div style={S.app}>
        <div style={S.gridBg} />

        {/* HEADER */}
        <header style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#2563eb,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 14, color: '#fff', boxShadow: '0 0 16px #2563eb40' }}>G</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: -.3 }}>
              <span style={{ color: '#2563eb' }}>#</span>Match<span style={{ color: '#38bdf8' }}>Via</span>Geperex
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 100, padding: '6px 15px', fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--gold)' }}>
            ⬡ Créditos: {credits}
          </div>
        </header>

        <main style={S.main}>
          {/* HERO */}
          <div className="fade-up" style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2563eb12', border: '1px solid #2563eb32', borderRadius: 100, padding: '5px 13px', fontSize: 11, fontWeight: 500, color: 'var(--accent2)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 16 }}>
              ◈ Motor de Selección con IA + OCR
            </div>
            <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 'clamp(1.8rem,4.5vw,3rem)', letterSpacing: -2, lineHeight: 1.05, marginBottom: 13 }}>
              <span style={{ color: '#2563eb' }}>#</span>Match<span style={{ color: 'var(--muted)', fontWeight: 400 }}>Via</span><span style={{ color: '#38bdf8' }}>Geperex</span>
            </h1>
            <p style={{ color: 'var(--muted)', fontSize: 15, fontWeight: 300, maxWidth: 500, margin: '0 auto', lineHeight: 1.65 }}>
              Sube un perfil de puesto y CVs — digitales <strong style={{ color: 'var(--text)', fontWeight: 500 }}>o escaneados</strong>. El motor OCR extrae el texto automáticamente antes del análisis con IA.
            </p>
          </div>

          {/* WORKFLOW GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 13, marginBottom: 16 }}>

            {/* STEP 1 */}
            <div style={S.card}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 25, height: 25, borderRadius: 7, background: 'linear-gradient(135deg,#2563eb,#818cf8)', fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 12, color: '#fff', marginBottom: 11 }}>1</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 13 }}>Perfil del Puesto</div>
              <DropZone icon="📄" label="Subir Perfil del Puesto" hint=".txt · .pdf · .docx" multiple={false} onFiles={handleJobFiles} inputRef={jobRef} />
              {jobFile && (
                <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <FileItem name={jobFile.name} status={jobFile.status} onRemove={() => { setJobFile(null); if (jobRef.current) jobRef.current.value = '' }} />
                  {jobFile.status === 'loading' && loadMsg && <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 3 }}>⟳ {loadMsg}</div>}
                </div>
              )}
            </div>

            {/* STEP 2 */}
            <div style={S.card}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 25, height: 25, borderRadius: 7, background: 'linear-gradient(135deg,#2563eb,#818cf8)', fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 12, color: '#fff', marginBottom: 11 }}>2</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 13 }}>CVs de Candidatos</div>
              <DropZone icon="👥" label="Subir CVs" hint=".txt · .pdf · .docx · Múltiples" multiple={true} onFiles={handleCvFiles} inputRef={cvRef} />
              {cvFiles.length > 0 && (
                <div style={{ marginTop: 9, display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 240, overflowY: 'auto' }}>
                  {cvFiles.map((cv, i) => (
                    <FileItem key={i} name={cv.name} status={cv.status} onRemove={() => removeCV(i)} />
                  ))}
                </div>
              )}
              {loadMsg && cvFiles.some(f => f.status === 'ocr' || f.status === 'loading') && (
                <div style={{ fontSize: 11, color: 'var(--gold)', marginTop: 6 }}>⟳ {loadMsg}</div>
              )}
            </div>

            {/* STEP 3 */}
            <div style={S.card}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 25, height: 25, borderRadius: 7, background: 'linear-gradient(135deg,#2563eb,#818cf8)', fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 12, color: '#fff', marginBottom: 11 }}>3</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 13 }}>Realizar Análisis</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 13 }}>
                {MODES.map(m => (
                  <button key={m.id} onClick={() => setMode(m.id)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 13px', background: mode === m.id ? '#2563eb15' : 'var(--surface2)',
                    border: `1px solid ${mode === m.id ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--r)', cursor: 'pointer', transition: 'all .2s',
                    fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: mode === m.id ? 'var(--text)' : 'var(--muted)',
                  }}>
                    <span style={mode === m.id ? { color: 'var(--accent2)', fontWeight: 600 } : {}}>{m.label}</span>
                    <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--gold)', background: '#f59e0b13', border: '1px solid #f59e0b2e', borderRadius: 100, padding: '3px 8px' }}>{m.cost} / CV</span>
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <button
                  style={{ ...S.btn('primary'), opacity: canAnalyze ? 1 : 0.35, cursor: canAnalyze ? 'pointer' : 'not-allowed' }}
                  disabled={!canAnalyze}
                  onClick={analyze}
                >
                  {loading ? '⟳ Analizando…' : '◈ Analizar'}
                </button>
                <button style={S.btn('ghost')} onClick={reset}>↺ Nueva Búsqueda</button>
              </div>

              {canAnalyze && (
                <div style={{ marginTop: 9, fontSize: 12, color: 'var(--dim)' }}>
                  Costo estimado: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{totalCost} créditos</span>
                </div>
              )}

              {error && (
                <div style={{ marginTop: 11, background: '#ef444410', border: '1px solid #ef444430', borderRadius: 'var(--r)', padding: '11px 13px', fontSize: 13, color: 'var(--red)', lineHeight: 1.5 }}>
                  ⚠ {error}
                </div>
              )}
            </div>
          </div>

          {/* CTA row */}
          <div style={{ textAlign: 'center', marginTop: 14, display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button style={S.btn('gold')} onClick={() => setModal(true)}>⬡ Comprar Más Créditos</button>
            {results && (
              <button style={S.btn('ghost')} onClick={() => {
                if (credits < 3) { notify('⚠', 'Necesitas 3 créditos', 'e'); return }
                setCredits(c => c - 3); notify('✓', 'PDF exportado · 3 créditos')
              }}>
                ↓ Exportar PDF <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--gold)', background: '#f59e0b13', border: '1px solid #f59e0b2e', borderRadius: 100, padding: '3px 8px', marginLeft: 4 }}>3 cr.</span>
              </button>
            )}
          </div>

          {/* RESULTS */}
          <div style={{ marginTop: 44 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 13, borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 19, letterSpacing: -.5 }}>Resultados de Compatibilidad</div>
                <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2, fontWeight: 300 }}>Candidatos ordenados por puntuación de compatibilidad.</div>
              </div>
            </div>

            {loading ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '48px 28px', textAlign: 'center' }}>
                <div style={{ width: 38, height: 38, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .8s linear infinite', margin: '0 auto 14px' }} />
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 5 }}>{loadMsg || 'Procesando…'}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 300 }}>La IA está evaluando compatibilidad y competencias…</div>
              </div>
            ) : results ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {results.candidates.map((c, i) => <CandidateCard key={i} candidate={c} idx={i} mode={results.mode} />)}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '52px 24px', background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 'var(--rl)' }}>
                <div style={{ fontSize: 42, opacity: .3, marginBottom: 13 }}>⬡</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, color: 'var(--muted)', marginBottom: 7 }}>Sin resultados aún</div>
                <div style={{ color: 'var(--dim)', fontSize: 13, maxWidth: 340, margin: '0 auto', lineHeight: 1.6 }}>
                  Sube archivos, elige un tipo de análisis y presiona <strong style={{ color: 'var(--text)' }}>Analizar</strong>.<br /><br />
                  ¡Comienza con <strong style={{ color: 'var(--gold)' }}>20 créditos</strong> de cortesía!<br /><br />
                  <span style={{ fontSize: 12, color: 'var(--accent2)' }}>✓ Soporte OCR para PDFs escaneados activado</span>
                </div>
              </div>
            )}
          </div>
        </main>

        <footer style={{ position: 'relative', zIndex: 5, textAlign: 'center', padding: 22, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--dim)' }}>
          <strong style={{ color: 'var(--muted)' }}>© 2025 #MatchViaGeperex.</strong> Todos los derechos reservados. · Creación de <strong style={{ color: 'var(--muted)' }}>GEPEREX SpA</strong>
        </footer>
      </div>

      {/* MODAL CRÉDITOS */}
      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(10,12,16,.82)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: 30, maxWidth: 400, width: '100%', boxShadow: '0 20px 70px rgba(0,0,0,.55)' }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 19, letterSpacing: -.5, marginBottom: 9 }}>⬡ Comprar Créditos</div>
            <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 20, fontWeight: 300 }}>Los créditos permiten realizar análisis con IA. Elige el paquete que mejor se adapte a tus necesidades.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
              {[[50,'$4.990'],[150,'$12.990'],[500,'$34.990']].map(([amt, price]) => (
                <div key={amt} onClick={() => { setCredits(c => c + amt); setModal(false); notify('⬡', `+${amt} créditos añadidos`) }} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '13px 9px', textAlign: 'center', cursor: 'pointer', transition: 'all .2s' }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 20, color: 'var(--gold)' }}>{amt}</div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 1 }}>créditos</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 5, fontWeight: 500 }}>{price}</div>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '18px 0' }} />
            <button style={{ ...S.btn('ghost'), width: '100%', justifyContent: 'center' }} onClick={() => setModal(false)}>Cerrar</button>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 22, right: 22, background: 'var(--surface)', border: `1px solid ${toast.type === 's' ? '#10b98138' : '#ef444438'}`, borderRadius: 'var(--r)', padding: '11px 17px', display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: 'var(--text)', zIndex: 200, boxShadow: '0 8px 34px rgba(0,0,0,.55)', maxWidth: 320, animation: 'slideIn .3s ease' }}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}
