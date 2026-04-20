import { useState, useRef } from 'react'
import { extractText } from './extractor.js'

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  navy:       '#1B2A4A',
  navyLt:     '#243860',
  sidebarBg:  '#1B2A4A',
  sidebarText:'#E8EDF5',
  sidebarMuted:'#7A8BAA',
  sidebarDim: 'rgba(255,255,255,0.08)',
  accent:     '#C9853A',
  accentDim:  'rgba(201,133,58,0.12)',
  orange:     '#E8671A',
  bg:         '#F5F6F8',
  surface:    '#FFFFFF',
  border:     '#E5E7EB',
  borderHi:   '#D1D5DB',
  text:       '#111827',
  muted:      '#4B5563',
  dim:        '#9CA3AF',
  green:      '#16A34A',
  greenLt:    '#22C55E',
  greenDim:   'rgba(22,163,74,0.10)',
  red:        '#B91C1C',
  redLt:      '#DC2626',
  redDim:     'rgba(185,28,28,0.10)',
  amber:      '#92600A',
  amberLt:    '#B8860B',
  amberDim:   'rgba(146,96,10,0.10)',
}

// ─── PROMPT: EXTRACCIÓN ESTRUCTURADA DEL PERFIL (Fase 1) ─────────────────────
const PROMPT_EXTRACT_PROFILE = `Eres un analista experto en diseño de perfiles de cargo para sectores de alta exigencia en Chile (Minería, Energía, Sector Público). Metodología: #MatchViaGeperex de GEPEREX LIMITADA.

TAREA: Lee el documento de perfil de cargo y extrae su estructura de forma completa y ordenada.
Si algún campo no está presente en el documento, usa null.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin backticks:
{
  "nombreCargo": "Título exacto del cargo",
  "area": "Área o Gerencia a la que reporta",
  "dependencia": "Cargo al que reporta directamente",
  "mision": "Misión o propósito del cargo, tal como aparece en el documento (1-3 oraciones)",
  "funciones": [
    "Función principal 1",
    "Función principal 2",
    "Función principal 3"
  ],
  "estudios": {
    "nivelRequerido": "Ej: Título profesional universitario / Técnico nivel superior / Enseñanza Media",
    "carrerasAceptadas": ["Carrera 1", "Carrera 2"],
    "requisitosAdicionales": "Ej: Colegiatura vigente, habilitación profesional, etc."
  },
  "experiencia": {
    "generalAnios": "Ej: 5 años en cargos similares",
    "especifica": [
      "Experiencia específica requerida 1",
      "Experiencia específica requerida 2"
    ],
    "sectoresDeseados": ["Sector 1", "Sector 2"]
  },
  "competencias": [
    "Competencia o habilidad clave 1",
    "Competencia o habilidad clave 2"
  ],
  "conocimientosTecnicos": [
    "Software/sistema/herramienta 1",
    "Conocimiento técnico 2"
  ],
  "idiomas": "Ej: Inglés nivel intermedio / No requerido",
  "condicionesEspeciales": [
    "Ej: Disponibilidad para trabajar en faena",
    "Ej: Licencia clase B vigente"
  ],
  "remuneracion": "Si está especificada, indicarla; si no, null",
  "jornada": "Ej: Jornada completa / Turno 7x7 / Part-time",
  "lugarTrabajo": "Ciudad o lugar físico del trabajo"
}
Solo JSON válido. Si un campo no existe en el documento, usa null o array vacío según corresponda.`

// ─── SYSTEM PROMPTS DIFERENCIADOS ─────────────────────────────────────────────
const PROMPTS = {
  profile: `Eres un experto senior en selección de personas para sectores de alta exigencia en Chile (Minería, Energía, Sector Público). Metodología: #MatchViaGeperex de GEPEREX LIMITADA.

MODO: ANÁLISIS DE PERFIL CURRICULAR
Se te entregará:
  1. Un CUADRO RESUMEN ESTRUCTURADO del cargo (ya extraído y validado)
  2. Uno o más CVs de candidatos

Tu tarea es contrastar CADA CV contra los requisitos del cuadro resumen y generar una evaluación detallada.

Criterios de scoring ponderado (usa los requisitos del cuadro como referencia explícita):
  - Formación académica (título, carrera, nivel): 30%
  - Años de experiencia general en el área: 25%
  - Experiencia específica requerida por el cargo: 25%
  - Formación complementaria / certificaciones: 10%
  - Condiciones especiales / conocimientos técnicos: 10%

Para cada criterio, indica en matchDetail si el candidato CUMPLE, CUMPLE PARCIALMENTE o NO CUMPLE el requisito específico del perfil.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin backticks:
{
  "candidates": [
    {
      "name": "Nombre completo del candidato (extráelo del CV; si no aparece, usa nombre del archivo sin extensión)",
      "fileName": "archivo.pdf",
      "score": 85,
      "recommendation": "CONTRATAR",
      "summary": "Análisis de 2-3 oraciones sobre compatibilidad curricular con el cargo, mencionando elementos concretos del perfil",
      "strengths": ["fortaleza concreta vs. requisito del cargo 1", "fortaleza 2", "fortaleza 3"],
      "gaps": ["brecha concreta vs. requisito del cargo 1", "brecha 2"],
      "matchDetail": {
        "formacion": {
          "requerido": "Lo que pide el perfil en formación",
          "candidato": "Lo que tiene el candidato",
          "cumple": "CUMPLE"
        },
        "experienciaGeneral": {
          "requerido": "Años/tipo de experiencia requerida",
          "candidato": "Años/tipo que tiene el candidato",
          "cumple": "CUMPLE PARCIALMENTE"
        },
        "experienciaEspecifica": {
          "requerido": "Experiencia específica del perfil",
          "candidato": "Experiencia específica del candidato",
          "cumple": "NO CUMPLE"
        },
        "formacionComplementaria": {
          "requerido": "Certificaciones/cursos del perfil",
          "candidato": "Certificaciones/cursos del candidato",
          "cumple": "CUMPLE"
        },
        "condicionesEspeciales": {
          "requerido": "Condiciones especiales del perfil",
          "candidato": "Si el candidato las cumple o no",
          "cumple": "CUMPLE"
        }
      },
      "scoreBreakdown": {
        "Formación Académica": 80,
        "Experiencia General": 90,
        "Experiencia Específica": 75,
        "Formación Complementaria": 70,
        "Condiciones Especiales": 85
      }
    }
  ]
}
recommendation: "CONTRATAR" | "RESERVA" | "NO RECOMENDAR"
cumple: "CUMPLE" | "CUMPLE PARCIALMENTE" | "NO CUMPLE"
score y scoreBreakdown de 0 a 100. Ordena por score descendente. Solo JSON válido.`,

}

// ─── MODOS ────────────────────────────────────────────────────────────────────
const MODES = [
  { id: 'profile', label: 'Análisis de Perfil', icon: '📋', cost: 2, color: C.navy,
    desc: 'Compatibilidad curricular vs. cargo',
    tooltip: 'Contrasta el CV contra los requisitos formales: formación, experiencia y condiciones.' },
  { id: 'compare', label: 'Vista Comparativa',  icon: '⚡', cost: 2, color: C.accent,
    desc: 'Ranking curricular entre candidatos',
    tooltip: 'Analiza todos los CVs y los rankea en una tabla comparativa. Ideal para 2 o más candidatos.' },
]

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const scoreColor = v => v >= 75 ? C.green : v >= 50 ? C.amber : C.red
const RECO_CFG = {
  'CONTRATAR':     { color: C.green,  bg: C.greenDim,  border: '#10B98130', icon: '✅' },
  'RESERVA':       { color: C.amber,  bg: C.amberDim,  border: '#F59E0B30', icon: '🟡' },
  'NO RECOMENDAR': { color: C.red,    bg: C.redDim,    border: '#F43F5E30', icon: '❌' },
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&family=Playfair+Display:wght@600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:${C.bg};color:${C.text};font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:${C.surface}}
::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}
::-webkit-scrollbar-thumb:hover{background:${C.borderHi}}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes slideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
@keyframes radarIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
.fade-up{animation:fadeUp .45s ease both}
.slide-in{animation:slideIn .35s ease both}
.glow-card{position:relative;background:${C.card};border:1px solid ${C.border};border-radius:12px;transition:border-color .25s,box-shadow .25s}
.glow-card:hover{border-color:${C.borderHi};box-shadow:0 4px 24px rgba(0,0,0,.5)}
.reco-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:100px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-family:'DM Mono',monospace}
.score-ring{display:flex;align-items:center;justify-content:center;flex-direction:column;width:68px;height:68px;border-radius:50%;border:3px solid;font-family:'DM Mono',monospace;font-size:19px;font-weight:700;flex-shrink:0}
.bar-row{display:grid;grid-template-columns:130px 1fr 36px;align-items:center;gap:9px;margin-bottom:6px}
.bar-track{height:5px;background:${C.border};border-radius:100px;overflow:hidden}
.bar-fill{height:100%;border-radius:100px;transition:width 1.1s ease}
.cmp-table{width:100%;border-collapse:collapse;font-size:13px}
.cmp-table th{background:${C.surface};padding:10px 14px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.muted};border-bottom:1px solid ${C.border}}
.cmp-table td{padding:11px 14px;border-bottom:1px solid ${C.border};vertical-align:middle}
.cmp-table tr:last-child td{border-bottom:none}
.cmp-table tr:hover td{background:rgba(255,255,255,.018)}
.spinner{width:30px;height:30px;border:2px solid ${C.border};border-top-color:${C.accent};border-radius:50%;animation:spin .7s linear infinite}
`

// ─── RADAR CHART ──────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const col = scoreColor(score)
  return (
    <div className="score-ring" style={{ borderColor: col, color: col, boxShadow: `0 0 18px ${col}22` }}>
      <span>{score}</span>
      <span style={{ fontSize: 9, letterSpacing: '.06em', opacity: .65 }}>/100</span>
    </div>
  )
}

function RecoBadge({ reco }) {
  const cfg = RECO_CFG[reco] || RECO_CFG['RESERVA']
  return (
    <span className="reco-badge" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.icon} {reco}
    </span>
  )
}

function BarRow({ label, value }) {
  const col = scoreColor(value)
  return (
    <div className="bar-row">
      <span style={{ fontSize: 11, color: C.muted, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${value}%`, background: col }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: "'DM Mono'", color: col, fontWeight: 700, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function DropZone({ icon, label, hint, multiple, onFiles, inputRef }) {
  const [over, setOver] = useState(false)
  return (
    <div onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files) }}
      style={{ border: `1.5px dashed ${over ? C.accent : C.border}`, borderRadius: 9, padding: '16px 12px', textAlign: 'center', cursor: 'pointer', background: over ? C.accentDim : 'transparent', transition: 'all .2s', position: 'relative' }}>
      <input ref={inputRef} type="file" accept=".txt,.pdf,.docx" multiple={multiple}
        onChange={e => onFiles(e.target.files)}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
      <div style={{ fontSize: 22, marginBottom: 5 }}>{icon}</div>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>
        <strong style={{ color: C.accent }}>{label}</strong>
      </div>
      <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{hint}</div>
    </div>
  )
}

function FileItem({ name, status, onRemove }) {
  const cols = { ready: C.green, ocr: C.amber, error: C.red, loading: C.muted }
  const icons = { ready: '✓', ocr: '⟳', error: '✗', loading: '…' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: '6px 10px', fontSize: 12 }}>
      <span style={{ color: cols[status] || C.muted, fontSize: 13 }}>{icons[status] || '…'}</span>
      <span style={{ flex: 1, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
      {onRemove && <span onClick={onRemove} style={{ cursor: 'pointer', color: C.dim, fontSize: 16, lineHeight: 1 }}>×</span>}
    </div>
  )
}


// ─── PROFILE CARD — Cuadro resumen estructurado del cargo ────────────────────
const CUMPLE_CFG = {
  'CUMPLE':             { color: '#10B981', bg: 'rgba(16,185,129,0.12)', icon: '✅' },
  'CUMPLE PARCIALMENTE':{ color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: '🟡' },
  'NO CUMPLE':          { color: '#F43F5E', bg: 'rgba(244,63,94,0.12)',  icon: '❌' },
}

function ProfileFieldRow({ label, value, mono = false }) {
  if (!value || (Array.isArray(value) && value.length === 0)) return null
  const display = Array.isArray(value) ? value.join(' · ') : value
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '148px 1fr', gap: 8, padding: '7px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 10, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 12, color: mono ? C.accent : C.text, fontFamily: mono ? "'DM Mono'" : "'DM Sans'", lineHeight: 1.55 }}>{display}</span>
    </div>
  )
}

function ProfileCard({ profile, loading }) {
  const [collapsed, setCollapsed] = useState(false)

  if (loading) return (
    <div className="glow-card fade-up" style={{ padding: '18px 22px', borderLeft: `3px solid ${C.accent}`, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className="spinner" />
      <div>
        <div style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 13, color: C.accent }}>Extrayendo estructura del perfil…</div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>La IA está leyendo el documento y organizando los requisitos del cargo</div>
      </div>
    </div>
  )

  if (!profile) return null

  return (
    <div className="glow-card fade-up" style={{ borderLeft: `3px solid ${C.accent}`, marginBottom: 4 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: collapsed ? 'none' : `1px solid ${C.border}`, cursor: 'pointer' }} onClick={() => setCollapsed(c => !c)}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(79,125,243,0.08)', border: `1px solid rgba(79,125,243,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📋</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, color: C.accent, fontFamily: "'DM Mono'", letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2 }}>
            Cuadro Resumen del Cargo · Referencia de Contraste
          </div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 18, lineHeight: 1.1, color: C.text }}>
            {profile.nombreCargo || 'Cargo no identificado'}
          </div>
          {(profile.area || profile.dependencia) && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
              {[profile.area, profile.dependencia].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {profile.jornada && (
            <span style={{ fontSize: 10, color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 100, padding: '3px 9px' }}>{profile.jornada}</span>
          )}
          {profile.lugarTrabajo && (
            <span style={{ fontSize: 10, color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 100, padding: '3px 9px' }}>📍 {profile.lugarTrabajo}</span>
          )}
          <span style={{ color: C.dim, fontSize: 14 }}>{collapsed ? '▸' : '▾'}</span>
        </div>
      </div>

      {!collapsed && (
        <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: '0 32px' }}>
          {/* Columna izquierda */}
          <div>
            {profile.mision && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Misión del Cargo</div>
                <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 13px', fontStyle: 'italic' }}>
                  "{profile.mision}"
                </div>
              </div>
            )}

            {profile.estudios && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Estudios Requeridos</div>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 13px' }}>
                  <ProfileFieldRow label="Nivel" value={profile.estudios.nivelRequerido} mono />
                  {profile.estudios.carrerasAceptadas?.length > 0 && (
                    <ProfileFieldRow label="Carreras" value={profile.estudios.carrerasAceptadas} />
                  )}
                  {profile.estudios.requisitosAdicionales && (
                    <ProfileFieldRow label="Adicionales" value={profile.estudios.requisitosAdicionales} />
                  )}
                </div>
              </div>
            )}

            {profile.experiencia && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Experiencia Requerida</div>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 13px' }}>
                  <ProfileFieldRow label="General" value={profile.experiencia.generalAnios} mono />
                  {profile.experiencia.sectoresDeseados?.length > 0 && (
                    <ProfileFieldRow label="Sectores" value={profile.experiencia.sectoresDeseados} />
                  )}
                  {profile.experiencia.especifica?.length > 0 && (
                    <div style={{ paddingTop: 8 }}>
                      <div style={{ fontSize: 10, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 5 }}>Específica</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {profile.experiencia.especifica.map((e, i) => (
                          <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                            <span style={{ color: C.accent, fontSize: 11, marginTop: 1, flexShrink: 0 }}>◈</span>
                            <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{e}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Columna derecha */}
          <div>
            {profile.funciones?.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Funciones Principales</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {profile.funciones.slice(0, 6).map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 7, padding: '8px 10px' }}>
                      <span style={{ fontFamily: "'DM Mono'", fontSize: 10, color: C.accent, fontWeight: 700, minWidth: 18, paddingTop: 1 }}>{String(i + 1).padStart(2, '0')}</span>
                      <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {profile.competencias?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Competencias</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {profile.competencias.map((c, i) => (
                      <span key={i} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 100, background: `${C.accent}12`, border: `1px solid ${C.accent}28`, color: C.accent, fontWeight: 500 }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {profile.conocimientosTecnicos?.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Conocim. Técnicos</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {profile.conocimientosTecnicos.map((k, i) => (
                      <span key={i} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 100, background: `${C.gold}12`, border: `1px solid ${C.gold}28`, color: C.gold, fontWeight: 500 }}>{k}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {profile.condicionesEspeciales?.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Condiciones Especiales</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {profile.condicionesEspeciales.map((c, i) => (
                    <span key={i} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 100, background: C.amberDim, border: `1px solid ${C.amber}28`, color: C.amber, fontWeight: 500 }}>⚠ {c}</span>
                  ))}
                </div>
              </div>
            )}

            {(profile.remuneracion || profile.idiomas) && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 13px' }}>
                <ProfileFieldRow label="Remuneración" value={profile.remuneracion} mono />
                <ProfileFieldRow label="Idiomas" value={profile.idiomas} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MATCH DETAIL SECTION (dentro de CandidateCard) ──────────────────────────
function MatchDetailTable({ matchDetail }) {
  if (!matchDetail) return null
  const labels = {
    formacion: 'Formación Académica',
    experienciaGeneral: 'Experiencia General',
    experienciaEspecifica: 'Experiencia Específica',
    formacionComplementaria: 'Formación Complementaria',
    condicionesEspeciales: 'Condiciones Especiales',
  }
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>
        Contraste Perfil vs. Candidato
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 9, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.surface }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.dim, width: '22%' }}>Criterio</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.dim, width: '34%' }}>Requerido por Perfil</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.dim, width: '34%' }}>Candidato aporta</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.dim, width: '10%' }}>Cumple</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(matchDetail).map(([key, val], i) => {
              const cfg = CUMPLE_CFG[val.cumple] || CUMPLE_CFG['CUMPLE PARCIALMENTE']
              return (
                <tr key={key} style={{ borderTop: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.012)' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 600, color: C.muted, fontSize: 11 }}>{labels[key] || key}</td>
                  <td style={{ padding: '9px 12px', color: C.dim, fontSize: 11, lineHeight: 1.5 }}>{val.requerido || '—'}</td>
                  <td style={{ padding: '9px 12px', color: C.text, fontSize: 11, lineHeight: 1.5 }}>{val.candidato || '—'}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono'", color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: 100, padding: '3px 8px', whiteSpace: 'nowrap' }}>
                      {cfg.icon} {val.cumple}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}


// ─── COMPETENCY CONTRAST TABLE (dentro de CandidateCard, modo competencies) ──
function CompetencyContrastTable({ competencyContrast }) {
  if (!competencyContrast?.length) return null
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>
        Contraste Diccionario vs. Candidato
      </div>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 9, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: C.surface }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.dim, width: '18%' }}>Competencia</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.dim, width: '10%' }}>Requerido</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.dim, width: '10%' }}>Observado</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.dim, width: '44%' }}>Evidencia levantada del CV</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.dim, width: '8%' }}>Score</th>
              <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: C.dim, width: '10%' }}>Brecha</th>
            </tr>
          </thead>
          <tbody>
            {competencyContrast.map((row, i) => {
              const nivelReqCfg  = NIVEL_CFG[row.nivelRequerido]  || NIVEL_CFG['INTERMEDIO']
              const nivelObsCfg  = NIVEL_CFG[row.nivelObservado]  || { color: C.dim, dot: '○' }
              const brechaCfg    = BRECHA_CFG[row.brecha]         || BRECHA_CFG['PARCIAL']
              return (
                <tr key={i} style={{ borderTop: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.012)' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 700, color: C.text, fontSize: 12, lineHeight: 1.4 }}>{row.competencia}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono'", color: nivelReqCfg.color }}>
                      {nivelReqCfg.dot} {row.nivelRequerido}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono'", color: nivelObsCfg.color }}>
                      {nivelObsCfg.dot || '○'} {row.nivelObservado}
                    </span>
                  </td>
                  <td style={{ padding: '9px 12px', color: C.muted, fontSize: 11, lineHeight: 1.6 }}>{row.evidencia}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                    <span style={{ fontFamily: "'DM Mono'", fontWeight: 700, fontSize: 14, color: scoreColor(row.score) }}>{row.score}</span>
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: brechaCfg.color, whiteSpace: 'nowrap' }}>
                      {brechaCfg.icon} {row.brecha}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── CANDIDATE CARD ───────────────────────────────────────────────────────────
function CandidateCard({ candidate: c, idx }) {
  const [open, setOpen] = useState(true)
  const rankColors = ['#EAB308', '#94A3B8', '#CD8B45']
  const rankLabels = ['🥇 1° Lugar', '🥈 2° Lugar', '🥉 3° Lugar']
  const borderLeft = `3px solid ${idx < 3 ? rankColors[idx] : C.border}`

  return (
    <div className="glow-card slide-in" style={{ padding: '20px 22px', borderLeft, animationDelay: `${idx * 0.06}s` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
        <ScoreRing score={c.score} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {idx < 3 && (
            <div style={{ fontSize: 9, fontWeight: 700, color: rankColors[idx], letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: "'DM Mono'", marginBottom: 3 }}>
              {rankLabels[idx]}
            </div>
          )}
          <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 17, lineHeight: 1.2, marginBottom: 5 }}>{c.name || 'Candidato'}</div>
          <div style={{ fontSize: 11, color: C.dim, marginBottom: 7 }}>{c.fileName}</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
            {c.recommendation && <RecoBadge reco={c.recommendation} />}
            {c.scoreProfile != null && (
              <span style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono'" }}>
                Perfil: <strong style={{ color: scoreColor(c.scoreProfile) }}>{c.scoreProfile}</strong>
                {' '}· Compet: <strong style={{ color: scoreColor(c.scoreCompetencies) }}>{c.scoreCompetencies}</strong>
              </span>
            )}
          </div>
        </div>
        <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, cursor: 'pointer', color: C.dim, fontSize: 11, padding: '5px 9px', fontFamily: "'DM Mono'", transition: 'all .2s' }}>
          {open ? '▾ ocultar' : '▸ ver'}
        </button>
      </div>

      {open && (
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            {(c.executiveSummary || c.summary) && (
              <div style={{ fontSize: 13, lineHeight: 1.7, color: C.muted, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                {c.executiveSummary || c.summary}
              </div>
            )}
            {c.strengths?.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, marginBottom: 5 }}>Fortalezas</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {c.strengths.map((s, i) => <span key={i} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 100, background: C.greenDim, border: `1px solid ${C.green}28`, color: C.green, fontWeight: 500 }}>{s}</span>)}
                </div>
              </div>
            )}
            {c.gaps?.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, marginBottom: 5 }}>Brechas</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {c.gaps.map((g, i) => <span key={i} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 100, background: C.redDim, border: `1px solid ${C.red}28`, color: C.red, fontWeight: 500 }}>{g}</span>)}
                </div>
              </div>
            )}
            {c.riskFactors?.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, marginBottom: 5 }}>Factores de Riesgo</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {c.riskFactors.map((r, i) => <span key={i} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 100, background: C.amberDim, border: `1px solid ${C.amber}28`, color: C.amber, fontWeight: 500 }}>⚠ {r}</span>)}
                </div>
              </div>
            )}
            {c.scoreBreakdown && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, marginBottom: 8 }}>Desglose Curricular</div>
                {Object.entries(c.scoreBreakdown).map(([k, v]) => <BarRow key={k} label={k} value={v} />)}
              </div>
            )}
            {/* Tabla de contraste perfil vs candidato — solo modo profile */}
            {c.matchDetail && <MatchDetailTable matchDetail={c.matchDetail} />}
            {c.competencyContrast?.length > 0 && <CompetencyContrastTable competencyContrast={c.competencyContrast} />}
          </div>
          {c.competencies && Object.keys(c.competencies).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700 }}>Radar Competencial</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── COMPARATIVE PANEL ────────────────────────────────────────────────────────
function ComparativePanel({ compareResults, onExportCSV }) {
  const { profile, competencies, full } = compareResults
  const [tab, setTab] = useState('matrix')

  const allNames = [...new Set([
    ...(profile?.candidates || []).map(c => c.name),
    ...(competencies?.candidates || []).map(c => c.name),
    ...(full?.candidates || []).map(c => c.name),
  ])]

  const find = (results, name) => results?.candidates?.find(c => c.name === name)

  const matrix = allNames.map(name => {
    const p = find(profile, name), co = find(competencies, name), f = find(full, name)
    const scores = [p?.score, co?.score, f?.score].filter(s => s != null)
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    return { name, p, co, f, avg }
  }).sort((a, b) => b.avg - a.avg)

  const tabStyle = active => ({
    padding: '7px 16px', borderRadius: 7, border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? C.accentDim : 'transparent',
    color: active ? C.accent : C.muted,
    fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 600,
    cursor: 'pointer', transition: 'all .2s',
  })

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {[{ id: 'matrix', label: '📊 Matriz Cruzada' }, { id: 'radars', label: '🕸 Radares' }, { id: 'ranking', label: '🏆 Ranking Final' }]
          .map(t => <button key={t.id} onClick={() => setTab(t.id)} style={tabStyle(tab === t.id)}>{t.label}</button>)}
        <button onClick={onExportCSV} style={{ marginLeft: 'auto', padding: '7px 16px', borderRadius: 7, border: `1px solid ${C.green}40`, background: C.greenDim, color: C.green, fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          ⬇ Exportar CSV
        </button>
      </div>

      {/* MATRIZ */}
      {tab === 'matrix' && (
        <div className="glow-card" style={{ overflow: 'auto' }}>
          <table className="cmp-table">
            <thead>
              <tr>
                <th style={{ minWidth: 160 }}>Candidato</th>
                <th style={{ textAlign: 'center' }}>📋 Perfil</th>
                <th style={{ textAlign: 'center' }}>🧠 Competencias</th>
                <th style={{ textAlign: 'center' }}>⚡ Promedio</th>
                <th>Recomendación</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => {
                const reco = row.f?.recommendation || row.co?.recommendation || row.p?.recommendation
                return (
                  <tr key={i}>
                    <td>
                      <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 14 }}>{row.name}</div>
                      {i < 3 && <div style={{ fontSize: 9, color: ['#EAB308','#94A3B8','#CD8B45'][i], fontFamily: "'DM Mono'", fontWeight: 700, letterSpacing: '.08em', marginTop: 2 }}>
                        {['🥇 MEJOR MATCH','🥈 2° LUGAR','🥉 3° LUGAR'][i]}
                      </div>}
                    </td>
                    {[row.p?.score, row.co?.score, row.f?.score].map((s, j) => (
                      <td key={j} style={{ textAlign: 'center' }}>
                        {s != null
                          ? <span style={{ fontFamily: "'DM Mono'", fontWeight: 700, fontSize: 16, color: scoreColor(s) }}>{s}</span>
                          : <span style={{ color: C.dim, fontSize: 12 }}>—</span>}
                      </td>
                    ))}
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontFamily: "'DM Mono'", fontWeight: 700, fontSize: 17, color: scoreColor(row.avg) }}>{row.avg}</span>
                    </td>
                    <td>{reco && <RecoBadge reco={reco} />}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* RADARES */}
      {tab === 'radars' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(270px,1fr))', gap: 14 }}>
          {matrix.map((row, i) => {
            const comps = row.f?.competencies || row.co?.competencies
            if (!comps) return (
              <div key={i} className="glow-card" style={{ padding: 18, textAlign: 'center' }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{row.name}</div>
                <div style={{ fontSize: 12, color: C.dim }}>Sin datos de competencias</div>
              </div>
            )
            const colors = [C.gold, C.accent, C.green, C.purple]
            const reco = row.f?.recommendation || row.co?.recommendation || row.p?.recommendation
            return (
              <div key={i} className="glow-card" style={{ padding: '18px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{row.name}</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {reco && <RecoBadge reco={reco} />}
                  <span style={{ fontFamily: "'DM Mono'", color: scoreColor(row.avg), fontWeight: 700, fontSize: 13 }}>AVG: {row.avg}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* RANKING */}
      {tab === 'ranking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {matrix.map((row, i) => {
            const reco = row.f?.recommendation || row.co?.recommendation || row.p?.recommendation
            const summary = row.f?.summary || row.p?.summary
            const rankColor = ['#EAB308','#94A3B8','#CD8B45'][i] || C.border
            return (
              <div key={i} className="glow-card" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, borderLeft: `3px solid ${rankColor}` }}>
                <div style={{ fontFamily: "'DM Mono'", fontWeight: 700, fontSize: 22, color: C.dim, minWidth: 32 }}>#{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 16, marginBottom: 3 }}>{row.name}</div>
                  {summary && <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{summary}</div>}
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    { label: 'Perfil', score: row.p?.score, color: C.accent },
                    { label: 'Compet.', score: row.co?.score, color: C.gold },
                    { label: 'AVG', score: row.avg, color: C.text },
                  ].map(({ label, score, color }) => (
                    <div key={label} style={{ textAlign: 'center', minWidth: 42 }}>
                      <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontFamily: "'DM Mono'", fontWeight: 700, fontSize: 17, color: score != null ? scoreColor(score) : C.dim }}>
                        {score ?? '—'}
                      </div>
                    </div>
                  ))}
                  {reco && <RecoBadge reco={reco} />}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [credits, setCredits]                   = useState(50)
  const [jobFile, setJobFile]                   = useState(null)
  const [profileData, setProfileData]           = useState(null)
  const [profileLoading, setProfileLoading]     = useState(false)
  const [cvFiles, setCvFiles]                   = useState([])
  const [mode, setMode]                     = useState('profile')
  const [loading, setLoading]               = useState(false)
  const [loadMsg, setLoadMsg]               = useState('')
  const [results, setResults]               = useState(null)
  const [compareResults, setCompareResults] = useState(null)
  const [activeView, setActiveView]         = useState('results')
  const [error, setError]                   = useState('')
  const [toast, setToast]                   = useState(null)
  const [modal, setModal]                   = useState(false)
  const jobRef = useRef()
  const cvRef  = useRef()

  const notify = (icon, msg, type = 's') => {
    setToast({ icon, msg, type })
    setTimeout(() => setToast(null), 3400)
  }

  async function handleJobFiles(fileList) {
    const file = fileList[0]
    if (!file) return
    setJobFile({ name: file.name, content: '', status: 'loading' })
    setProfileData(null)
    setCompetencyDict(null)
    setResults(null)
    setCompareResults(null)
    try {
      const extracted = await extractText(file, msg => setLoadMsg(msg))
      setJobFile({ name: file.name, content: extracted, status: 'ready' })
      notify('✓', 'Perfil cargado — extrayendo estructura y competencias…')
      // Fase 1: extracciones secuenciales (evita límite de concurrencia Netlify)
      await extractProfileStructure(extracted, file.name)
    } catch (e) {
      setJobFile({ name: file.name, content: '', status: 'error' })
      notify('✗', `Error: ${e.message}`, 'e')
    }
  }

  async function callExtractAPI(systemPrompt, userContent) {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    const raw = data.content?.map(b => b.text || '').join('') || ''
    const clean = raw.replace(/```json|```/g, '').trim()
    try { return JSON.parse(clean) }
    catch { const m = clean.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); throw new Error('JSON inválido') }
  }

  async function extractProfileStructure(content, fileName) {
    setProfileLoading(true)
    try {
      const parsed = await callExtractAPI(
        PROMPT_EXTRACT_PROFILE,
        `DOCUMENTO DE PERFIL DE CARGO (${fileName}):

${content.slice(0, 4000)}`
      )
      setProfileData(parsed)
      notify('✓', `Cuadro de perfil extraído — ${parsed.nombreCargo || 'cargo identificado'}`)
    } catch (e) {
      notify('⚠', `Estructura del perfil: ${e.message}`, 'w')
    } finally {
      setProfileLoading(false)
      setLoadMsg('')
    }
  }

  async function handleCvFiles(fileList) {
    const files = Array.from(fileList)
    if (!files.length) return
    const placeholders = files.map(f => ({ name: f.name, content: '', status: 'loading' }))
    setCvFiles(prev => {
      const base = prev.length
      const next = [...prev, ...placeholders]
      Promise.all(files.map(async (file, i) => {
        try {
          const content = await extractText(file, () => {
            setCvFiles(p => { const n = [...p]; n[base + i] = { ...n[base + i], status: 'ocr' }; return n })
          })
          setCvFiles(p => { const n = [...p]; n[base + i] = { name: file.name, content, status: 'ready' }; return n })
        } catch {
          setCvFiles(p => { const n = [...p]; n[base + i] = { name: file.name, content: '', status: 'error' }; return n })
        }
      })).then(() => notify('✓', `${files.length} CV(s) procesados`))
      return next
    })
  }

  async function callAnalyze(modeId, cvList) {
    const modeLabel = MODES.find(m => m.id === modeId)?.label
    let userPrompt = ''

    if (profileData) {
      userPrompt += `CUADRO RESUMEN ESTRUCTURADO DEL CARGO:\n${JSON.stringify(profileData, null, 2)}\n\n`
      userPrompt += `PERFIL ORIGINAL (${jobFile.name}):\n${jobFile.content.slice(0, 1500)}\n\n`
    } else {
      userPrompt += `PERFIL DEL CARGO (${jobFile.name}):\n${jobFile.content.slice(0, 2000)}\n\n`
    }

    cvList.forEach((cv, i) => { userPrompt += `--- CV ${i + 1}: ${cv.name} ---\n${cv.content.slice(0, 1500)}\n\n` })

    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3500,
        system: PROMPTS[modeId],
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => ({}))
      throw new Error(e?.error?.message || `HTTP ${res.status}`)
    }
    const data = await res.json()
    const raw = data.content?.map(b => b.text || '').join('') || ''
    const clean = raw.replace(/```json|```/g, '').trim()
    // Intento de reparación si el JSON viene truncado
    let repaired = clean
    // Contar llaves y corchetes para detectar truncamiento
    const openBraces   = (repaired.match(/\{/g) || []).length
    const closeBraces  = (repaired.match(/\}/g) || []).length
    const openBrackets = (repaired.match(/\[/g) || []).length
    const closeBrackets= (repaired.match(/\]/g) || []).length
    // Si está truncado, cerrar estructuras abiertas
    if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
      // Truncar en el último objeto completo válido
      const lastValidObj = repaired.lastIndexOf('},')
      if (lastValidObj > 100) {
        repaired = repaired.slice(0, lastValidObj + 1) + ']}' 
      }
    }
    try { return JSON.parse(repaired) }
    catch {
      try {
        const m = repaired.match(/\{[\s\S]*\}/)
        if (m) return JSON.parse(m[0])
      } catch {}
      throw new Error('Respuesta de IA incompleta — intenta con menos CVs o un análisis más simple.')
    }
  }

  const ready = cvFiles.filter(f => f.status === 'ready')
  const currentMode = MODES.find(m => m.id === mode)
  const totalCost = currentMode ? currentMode.cost * (mode === 'compare' ? ready.length : ready.length) : 0
  const canAnalyze = jobFile?.status === 'ready' && ready.length > 0 && !loading

  async function analyze() {
    setError('')
    if (credits < totalCost) { notify('⚠', `Necesitas ${totalCost} créditos`, 'e'); return }
    setLoading(true)
    setResults(null)
    setCompareResults(null)

    try {
      if (mode === 'compare') {
        // Secuencial para respetar límite de concurrencia de Netlify gratuito
        setLoadMsg('Ejecutando análisis de perfil (1/3)…')
        const profileData = await callAnalyze('profile', ready).catch(() => null)
        setLoadMsg('Ejecutando análisis de competencias (2/3)…')
        const compData    = await callAnalyze('competencies', ready).catch(() => null)
        const fullData    = await callAnalyze('full', ready).catch(() => null)
        setCompareResults({ profile: profileData, competencies: compData, full: fullData })
        setActiveView('compare')
      } else {
        setLoadMsg(`Analizando ${ready.length} candidato(s)…`)
        const parsed = await callAnalyze(mode, ready)
        setResults({ candidates: parsed.candidates || [], mode })
        setActiveView('results')
      }
      setCredits(c => c - totalCost)
      notify('✓', `Análisis completado · ${totalCost} créditos`)
    } catch (err) {
      setError(err.message)
      notify('✗', 'Error en el análisis', 'e')
    } finally {
      setLoading(false)
      setLoadMsg('')
    }
  }

  function exportCSV() {
    if (!compareResults) return
    const { profile, competencies, full } = compareResults
    const allNames = [...new Set([
      ...(profile?.candidates || []).map(c => c.name),
      ...(competencies?.candidates || []).map(c => c.name),
      ...(full?.candidates || []).map(c => c.name),
    ])]
    const rows = [['Candidato', 'Score Perfil', 'Recomendación', 'Resumen']]
    allNames.forEach(name => {
      const p  = profile?.candidates?.find(c => c.name === name)
      const co = competencies?.candidates?.find(c => c.name === name)
      const f  = full?.candidates?.find(c => c.name === name)
      const scores = [p?.score, co?.score, f?.score].filter(s => s != null)
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : ''
      const reco = f?.recommendation || co?.recommendation || p?.recommendation || ''
      const summary = f?.summary || p?.summary || ''
      rows.push([name, p?.score ?? '', co?.score ?? '', f?.score ?? '', avg, reco, summary])
    })
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `MatchViaGeperex_Comparativo_${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
    notify('⬇', 'CSV exportado correctamente')
  }

  function reset() {
    setJobFile(null); setProfileData(null); setCompetencyDict(null); setCvFiles([])
    setResults(null); setCompareResults(null)
    setError(''); setActiveView('results')
    if (jobRef.current) jobRef.current.value = ''
    if (cvRef.current) cvRef.current.value = ''
    notify('↺', 'Reiniciado')
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      {/* BG */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: C.bg }} />

      {/* HEADER */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', height: 54, background: 'rgba(6,8,16,.9)', backdropFilter: 'blur(16px)', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono'", fontWeight: 700, fontSize: 13, color: '#000', boxShadow: `0 0 16px ${C.accent}40` }}>G</div>
          <div>
            <div style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 15 }}>
              <span style={{ color: C.accent }}>#</span>Match<span style={{ color: C.muted, fontWeight: 300 }}>Via</span>Geperex
            </div>
            <div style={{ fontFamily: "'DM Mono'", fontSize: 9, color: C.dim, letterSpacing: '.1em' }}>GEPEREX LIMITADA · RUT 78.110.793-K</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontFamily: "'DM Mono'", fontSize: 12, color: C.gold, background: C.goldDim, border: `1px solid ${C.gold}30`, borderRadius: 100, padding: '5px 13px', fontWeight: 700 }}>
            ⬡ {credits} créditos
          </div>
          <button onClick={() => setModal(true)} style={{ padding: '5px 13px', borderRadius: 100, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans'", fontWeight: 600 }}>+ Comprar</button>
        </div>
      </header>

      {/* MAIN */}
      <main style={{ position: 'relative', zIndex: 5, maxWidth: 1100, margin: '0 auto', padding: '36px 18px 80px' }}>
        {/* Hero */}
        <div className="fade-up" style={{ marginBottom: 34, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(79,125,243,0.08)', border: `1px solid rgba(79,125,243,0.2)`, borderRadius: 100, padding: '4px 14px', fontSize: 10, color: C.accent, fontFamily: "'DM Mono'", letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 14 }}>
            ◈ Motor de Selección IA + OCR · v2.0
          </div>
          <h1 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 'clamp(1.9rem,5vw,3rem)', letterSpacing: '-.03em', lineHeight: 1, marginBottom: 12 }}>
            <span style={{ color: C.accent }}>#</span>Match<em style={{ fontStyle: 'italic', color: C.muted, fontWeight: 300 }}>Via</em><span style={{ color: '#8AAAF7' }}>Geperex</span>
          </h1>
          <p style={{ color: C.muted, fontSize: 14, maxWidth: 480, margin: '0 auto', lineHeight: 1.7, fontWeight: 300 }}>
            Tres modos de análisis con <strong style={{ color: C.text, fontWeight: 500 }}>prompts especializados</strong> + <strong style={{ color: C.purple, fontWeight: 500 }}>Vista Comparativa Cross-Modal</strong> con radar charts y exportación CSV.
          </p>
        </div>

        {/* Workflow grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 14 }}>
          {/* Step 1 */}
          <div className="glow-card fade-up" style={{ padding: '18px 20px', animationDelay: '.05s' }}>
            <StepHeader n="1" label="Perfil del Puesto" />
            <DropZone icon="📄" label="Subir Perfil" hint=".txt · .pdf · .docx" multiple={false} onFiles={handleJobFiles} inputRef={jobRef} />
            {jobFile && (
              <div style={{ marginTop: 8 }}>
                <FileItem name={jobFile.name} status={jobFile.status} onRemove={() => { setJobFile(null); if (jobRef.current) jobRef.current.value = '' }} />
                {jobFile.status === 'loading' && loadMsg && <div style={{ fontSize: 10, color: C.amber, marginTop: 4 }}>⟳ {loadMsg}</div>}
              </div>
            )}
          </div>

          {/* Step 2 */}
          <div className="glow-card fade-up" style={{ padding: '18px 20px', animationDelay: '.1s' }}>
            <StepHeader n="2" label="CVs Candidatos" />
            <DropZone icon="👥" label="Subir CVs" hint=".txt · .pdf · .docx · Múltiples" multiple={true} onFiles={handleCvFiles} inputRef={cvRef} />
            {cvFiles.length > 0 && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
                {cvFiles.map((cv, i) => <FileItem key={i} name={cv.name} status={cv.status} onRemove={() => setCvFiles(p => p.filter((_, j) => j !== i))} />)}
              </div>
            )}
          </div>

          {/* Step 3 */}
          <div className="glow-card fade-up" style={{ padding: '18px 20px', animationDelay: '.15s' }}>
            <StepHeader n="3" label="Tipo de Análisis" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
              {MODES.map(m => (
                <button key={m.id} onClick={() => setMode(m.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 12px', background: mode === m.id ? `${m.color}12` : 'transparent', border: `1px solid ${mode === m.id ? m.color + '50' : C.border}`, borderRadius: 8, cursor: 'pointer', transition: 'all .2s', fontFamily: "'DM Sans'", fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span>{m.icon}</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ color: mode === m.id ? m.color : C.text, fontWeight: 600 }}>{m.label}</div>
                      <div style={{ fontSize: 10, color: C.dim, marginTop: 1 }}>{m.desc}</div>
                    </div>
                  </div>
                  <span style={{ fontFamily: "'DM Mono'", fontSize: 10, color: C.gold, background: C.goldDim, border: `1px solid ${C.gold}30`, borderRadius: 100, padding: '2px 7px', fontWeight: 700, flexShrink: 0 }}>{m.cost}cr</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 7 }}>
              <button onClick={analyze} disabled={!canAnalyze} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: canAnalyze ? C.accent : C.surface, color: canAnalyze ? '#fff' : C.dim, fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 13, cursor: canAnalyze ? 'pointer' : 'not-allowed', opacity: canAnalyze ? 1 : .5, transition: 'all .2s', boxShadow: canAnalyze ? `0 4px 16px ${C.accent}30` : 'none' }}>
                {loading ? '⟳ Analizando…' : '◈ Analizar'}
              </button>
              <button onClick={reset} style={{ padding: '9px 13px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', fontFamily: "'DM Sans'", fontSize: 13, fontWeight: 600 }}>↺</button>
            </div>
            {canAnalyze && (
              <div style={{ marginTop: 8, fontSize: 11, color: C.dim, textAlign: 'center' }}>
                Costo: <span style={{ color: C.gold, fontWeight: 700 }}>{totalCost} créditos</span>
                {mode === 'compare' && <span style={{ color: C.muted }}> · 3 análisis paralelos</span>}
              </div>
            )}
            {error && <div style={{ marginTop: 10, background: C.redDim, border: `1px solid ${C.red}30`, borderRadius: 8, padding: '10px 12px', fontSize: 12, color: C.red, lineHeight: 1.5 }}>⚠ {error}</div>}
          </div>
        </div>

        {/* Results area */}
        <div style={{ marginTop: 32 }}>

          {/* ── PROFILE CARD: cuadro estructurado (siempre visible tras cargar perfil) */}
          {(profileData || profileLoading) && (
            <div style={{ marginBottom: 12 }}>
              <ProfileCard profile={profileData} loading={profileLoading} />
            </div>
          )}




          {(results || compareResults) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {results && (
                <button onClick={() => setActiveView('results')} style={{ padding: '7px 16px', borderRadius: 7, border: `1px solid ${activeView === 'results' ? C.accent : C.border}`, background: activeView === 'results' ? C.accentDim : 'transparent', color: activeView === 'results' ? C.accent : C.muted, fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  📋 Resultados
                </button>
              )}
              {compareResults && (
                <button onClick={() => setActiveView('compare')} style={{ padding: '7px 16px', borderRadius: 7, border: `1px solid ${activeView === 'compare' ? C.purple : C.border}`, background: activeView === 'compare' ? C.purpleDim : 'transparent', color: activeView === 'compare' ? C.purple : C.muted, fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  ⚡ Vista Comparativa
                </button>
              )}
            </div>
          )}

          {loading && (
            <div className="glow-card" style={{ padding: '48px 28px', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{loadMsg || 'Procesando…'}</div>
              {mode === 'compare' && <div style={{ fontSize: 12, color: C.muted }}>3 análisis con prompts especializados ejecutándose en paralelo</div>}
            </div>
          )}

          {!loading && activeView === 'results' && results && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ marginBottom: 6 }}>
                <h2 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 20 }}>
                  {MODES.find(m => m.id === results.mode)?.label}
                </h2>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{results.candidates.length} candidato(s) evaluado(s)</div>
              </div>
              {results.candidates.map((c, i) => <CandidateCard key={i} candidate={c} idx={i} />)}
            </div>
          )}

          {!loading && activeView === 'compare' && compareResults && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Vista Comparativa Cross-Modal</h2>
                <div style={{ fontSize: 12, color: C.muted }}>3 análisis con prompts especializados · Comparación matricial · Radar charts · Exportación CSV</div>
              </div>
              <ComparativePanel compareResults={compareResults} onExportCSV={exportCSV} />
            </div>
          )}

          {!loading && !results && !compareResults && (
            <div style={{ textAlign: 'center', padding: '52px 24px', background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 14 }}>
              <div style={{ fontSize: 40, opacity: .2, marginBottom: 14 }}>◈</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 17, color: C.muted, marginBottom: 8 }}>Sin resultados aún</div>
              <div style={{ color: C.dim, fontSize: 13, maxWidth: 380, margin: '0 auto', lineHeight: 1.7 }}>
                Sube archivos, elige análisis y presiona <strong style={{ color: C.text }}>Analizar</strong>.<br />
                Para la <strong style={{ color: C.purple }}>Vista Comparativa ⚡</strong>, selecciona ese modo.<br /><br />
                <span style={{ fontSize: 11, color: C.accent }}>✓ OCR activo · 3 prompts especializados · Radar SVG · CSV exportable</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer style={{ position: 'relative', zIndex: 5, textAlign: 'center', padding: '18px 24px', borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.dim }}>
        © {new Date().getFullYear()} <strong style={{ color: C.muted }}>Geperex Limitada</strong> · RUT 78.110.793-K · #MatchViaGeperex · Powered by Claude AI
      </footer>

      {/* MODAL */}
      {modal && (
        <div onClick={e => { if (e.target === e.currentTarget) setModal(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(6,8,16,.87)', backdropFilter: 'blur(10px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
          <div className="glow-card" style={{ padding: 28, maxWidth: 370, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,.6)' }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: 20, marginBottom: 8 }}>⬡ Comprar Créditos</div>
            <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.6, marginBottom: 20, fontWeight: 300 }}>Elige el paquete para tus procesos de selección.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 18 }}>
              {[[50,'$4.990'],[150,'$12.990'],[500,'$34.990']].map(([amt, price]) => (
                <div key={amt} onClick={() => { setCredits(c => c + amt); setModal(false); notify('⬡', `+${amt} créditos añadidos`) }}
                  style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 10px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .2s' }}>
                  <div style={{ fontFamily: "'DM Mono'", fontWeight: 700, fontSize: 22, color: C.gold }}>{amt}</div>
                  <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>créditos</div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 6, fontWeight: 500 }}>{price}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setModal(false)} style={{ width: '100%', padding: '9px', borderRadius: 8, border: `1px solid ${C.border}`, background: 'transparent', color: C.muted, cursor: 'pointer', fontFamily: "'DM Sans'", fontWeight: 600 }}>Cerrar</button>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, background: C.card, border: `1px solid ${toast.type === 's' ? C.green + '40' : C.red + '40'}`, borderRadius: 10, padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: C.text, zIndex: 300, boxShadow: '0 8px 40px rgba(0,0,0,.6)', maxWidth: 320, animation: 'slideIn .3s ease' }}>
          <span>{toast.icon}</span><span>{toast.msg}</span>
        </div>
      )}
    </>
  )
}

// ─── STEP HEADER (inline helper) ─────────────────────────────────────────────
function StepHeader({ n, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <div style={{ width: 22, height: 22, borderRadius: 6, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: "'DM Mono'", flexShrink: 0 }}>{n}</div>
      <div style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 13 }}>{label}</div>
    </div>
  )
}
