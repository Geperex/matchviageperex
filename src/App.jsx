import { useState, useRef } from 'react'
import { extractText } from './extractor.js'

// ─── PALETA GEPEREX ───────────────────────────────────────────────────────────
const C = {
  // Sidebar
  sidebarBg:   '#1B2A4A',
  sidebarBd:   '#243660',
  sidebarText: '#E8EDF5',
  sidebarMuted:'#8A9BBF',
  sidebarDim:  '#3D527A',
  // Content
  bg:          '#F4F6F9',
  surface:     '#FFFFFF',
  border:      '#E2E6ED',
  borderHi:    '#C5CDD8',
  // Brand
  navy:        '#1B2A4A',
  navyLt:      '#243660',
  accent:      '#C9853A',
  accentLt:    '#DFA05A',
  accentDim:   'rgba(201,133,58,0.12)',
  orange:      '#E8671A',  // CTA button
  // Semáforos
  green:       '#1A7A45',
  greenLt:     '#22A05A',
  greenDim:    'rgba(26,122,69,0.10)',
  red:         '#B91C1C',
  redLt:       '#DC2626',
  redDim:      'rgba(185,28,28,0.10)',
  amber:       '#92600A',
  amberLt:     '#B8860B',
  amberDim:    'rgba(146,96,10,0.10)',
  // Texto
  text:        '#111827',
  muted:       '#4B5563',
  dim:         '#9CA3AF',
}

// ─── PROMPTS (sin cambios) ────────────────────────────────────────────────────
const PROMPT_EXTRACT_PROFILE = `Extrae la estructura del perfil de cargo. IMPORTANTE para el campo "competencias": busca en TODO el documento cualquier lista de competencias, habilidades o capacidades requeridas. Pueden aparecer bajo títulos como "Competencias", "Habilidades", "Capacidades", "Perfil conductual", o como ítems numerados/codificados (C1, 1., a), etc.). Extrae SOLO el nombre de cada competencia, sin definición ni descripción. Si no encuentras ninguna, usa [].
Solo JSON válido, sin markdown, sin backticks:
{"nombreCargo":"string","area":"string|null","dependencia":"string|null","mision":"string|null","funciones":["string"],"estudios":{"nivelRequerido":"string|null","carrerasAceptadas":["string"],"requisitosAdicionales":"string|null"},"experiencia":{"generalAnios":"string|null","especifica":["string"],"sectoresDeseados":["string"]},"competencias":["string"],"conocimientosTecnicos":["string"],"idiomas":"string|null","condicionesEspeciales":["string"],"remuneracion":"string|null","jornada":"string|null","lugarTrabajo":"string|null"}`


const PROMPTS = {
  profile: `Eres un experto en selección de personas para sectores de alta exigencia en Chile. Metodología: #MatchViaGeperex.
INSTRUCCIÓN CRÍTICA: Responde SOLO con JSON puro, SIN backticks, SIN markdown, SIN texto antes o después.

MODO: ANÁLISIS DE PERFIL CURRICULAR
Se te entregará:
  1. Un CUADRO RESUMEN ESTRUCTURADO del cargo (ya extraído y validado)
  2. Uno o más CVs de candidatos

Tu tarea es contrastar CADA CV contra los requisitos del cuadro resumen y generar una evaluación detallada.
Criterios de scoring ponderado: Formación académica 30% · Experiencia general 25% · Experiencia específica 25% · Formación complementaria 10% · Condiciones especiales 10%.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin backticks:
{
  "candidates": [
    {
      "name": "Nombre completo del candidato",
      "fileName": "archivo.pdf",
      "score": 85,
      "recommendation": "CONTRATAR",
      "summary": "Análisis de 2-3 oraciones sobre compatibilidad curricular con el cargo",
      "strengths": ["fortaleza 1","fortaleza 2","fortaleza 3"],
      "gaps": ["brecha 1","brecha 2"],
      "matchDetail": {
        "formacion": {"requerido": "texto","candidato": "texto","cumple": "CUMPLE"},
        "experienciaGeneral": {"requerido": "texto","candidato": "texto","cumple": "CUMPLE PARCIALMENTE"},
        "experienciaEspecifica": {"requerido": "texto","candidato": "texto","cumple": "NO CUMPLE"},
        "formacionComplementaria": {"requerido": "texto","candidato": "texto","cumple": "CUMPLE"},
        "condicionesEspeciales": {"requerido": "texto","candidato": "texto","cumple": "CUMPLE"}
      },
      "scoreBreakdown": {"Formación Académica": 80,"Experiencia General": 90,"Experiencia Específica": 75,"Formación Complementaria": 70,"Condiciones Especiales": 85}
    }
  ]
}
recommendation: "CONTRATAR" | "RESERVA" | "NO RECOMENDAR". cumple: "CUMPLE" | "CUMPLE PARCIALMENTE" | "NO CUMPLE". Ordena por score descendente.`,

}

const MODES = [
  { id: 'profile', label: 'Análisis de Perfil', icon: '📋', cost: 2,
    desc: 'Compatibilidad curricular',
    tooltip: 'Contrasta el CV contra los requisitos formales del cargo: formación, experiencia, certificaciones y condiciones especiales.' },
  { id: 'compare', label: 'Vista Comparativa',  icon: '⚡', cost: 2,
    desc: 'Ranking entre candidatos',
    tooltip: 'Analiza todos los CVs contra el perfil y los rankea en una tabla comparativa. Ideal para decidir entre 2 o más candidatos.' },
]

const TABS = [
  { id: 'resumen',     label: 'Resumen Ejecutivo' },
  { id: 'detalle',     label: 'Detalle Curricular' },
  { id: 'comparativa', label: 'Análisis Comparativo' },
]

const RECO = {
  'CONTRATAR':     { color: C.green,   bg: C.greenDim,  border: C.greenLt,  label: 'RECOMENDADO',    dot: '#22A05A' },
  'RESERVA':       { color: C.amber,   bg: C.amberDim,  border: C.amberLt,  label: 'EN RESERVA',     dot: '#B8860B' },
  'NO RECOMENDAR': { color: C.red,     bg: C.redDim,    border: C.redLt,    label: 'NO RECOMENDADO', dot: '#DC2626' },
}

const scoreColor = v => v >= 75 ? C.navy : v >= 50 ? C.accent : C.red

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:${C.bg};color:${C.text};font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh}
::-webkit-scrollbar{width:5px;height:5px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:3px}

/* Layout */
.shell{display:flex;min-height:100vh}

/* Sidebar */
.sidebar{
  width:300px;min-width:300px;
  background:${C.sidebarBg};
  display:flex;flex-direction:column;
  position:sticky;top:0;height:100vh;
  overflow-y:auto;overflow-x:hidden;
  scrollbar-width:thin;
  scrollbar-color:${C.sidebarDim} transparent;
}
.sidebar::-webkit-scrollbar{width:3px}
.sidebar::-webkit-scrollbar-thumb{background:${C.sidebarDim}}
@media(max-width:900px){.sidebar{width:260px;min-width:260px}}

/* Sidebar header */
.sb-header{
  padding:20px 18px 16px;
  border-bottom:1px solid ${C.sidebarDim};
  display:flex;align-items:center;gap:10px;
}
.sb-logo{
  width:36px;height:36px;border-radius:8px;
  background:${C.accent};
  display:flex;align-items:center;justify-content:center;
  font-family:'DM Mono',monospace;font-weight:700;font-size:14px;color:#fff;
  flex-shrink:0;
}

/* Sidebar section */
.sb-section{padding:14px 16px;border-bottom:1px solid ${C.sidebarDim}}
.sb-section-title{
  display:flex;align-items:center;gap:8px;
  margin-bottom:10px;
}
.sb-step{
  width:20px;height:20px;border-radius:5px;
  background:${C.accent};
  display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:700;color:#fff;
  font-family:'DM Mono',monospace;flex-shrink:0;
}
.sb-step.navy{background:${C.navyLt};border:1px solid ${C.sidebarDim}}
.sb-label{font-size:11px;font-weight:700;color:${C.sidebarText};text-transform:uppercase;letter-spacing:.06em}
.sb-sublabel{font-size:10px;color:${C.sidebarMuted};margin-top:1px}

/* Dropzone */
.dropzone{
  border:1.5px dashed ${C.sidebarDim};border-radius:8px;
  background:rgba(255,255,255,.04);
  padding:14px 12px;text-align:center;cursor:pointer;
  transition:all .2s;position:relative;
}
.dropzone:hover,.dropzone.drag{border-color:${C.accent};background:rgba(201,133,58,.08)}
.dropzone input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.dropzone-icon{font-size:20px;margin-bottom:4px;opacity:.6}
.dropzone-label{font-size:11px;font-weight:600;color:${C.sidebarText}}
.dropzone-hint{font-size:9px;color:${C.sidebarMuted};margin-top:2px;font-family:'DM Mono',monospace}

/* File item sidebar */
.sb-file{
  display:flex;align-items:center;gap:7px;
  background:rgba(255,255,255,.06);
  border:1px solid ${C.sidebarDim};
  border-radius:7px;padding:7px 9px;
  margin-bottom:5px;
  animation:fadeIn .25s ease both;
}
.sb-file-icon{
  width:28px;height:28px;border-radius:5px;
  display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:700;color:#fff;flex-shrink:0;
  font-family:'DM Mono',monospace;
}
.sb-file-name{font-size:11px;color:${C.sidebarText};flex:1;min-width:0;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-file-status{font-size:10px;color:${C.greenLt};flex-shrink:0}
.sb-file-del{background:none;border:none;cursor:pointer;color:${C.sidebarMuted};
  font-size:14px;padding:0 2px;transition:color .15s;flex-shrink:0}
.sb-file-del:hover{color:${C.redLt}}

/* Mode radio */
.mode-item{
  display:flex;align-items:center;gap:9px;
  padding:8px 10px;border-radius:8px;
  cursor:pointer;transition:background .15s;margin-bottom:4px;
}
.mode-item:hover{background:rgba(255,255,255,.05)}
.mode-item.active{background:rgba(201,133,58,.12);border:1px solid rgba(201,133,58,.3)}
.mode-item:not(.active){border:1px solid transparent}
.mode-radio{
  width:16px;height:16px;border-radius:50%;
  border:2px solid ${C.sidebarDim};
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;transition:all .15s;
}
.mode-radio.on{border-color:${C.accent};background:${C.accent}}
.mode-radio.on::after{content:'';width:5px;height:5px;border-radius:50%;background:#fff}
.mode-label{font-size:11px;font-weight:600;color:${C.sidebarText};flex:1}
.mode-sub{font-size:9px;color:${C.sidebarMuted};margin-top:1px}
.mode-cost{
  font-family:'DM Mono',monospace;font-size:10px;font-weight:700;
  color:${C.accent};background:rgba(201,133,58,.12);
  border:1px solid rgba(201,133,58,.25);
  border-radius:100px;padding:2px 7px;flex-shrink:0;
}

/* CTA */
.cta-wrap{padding:14px 16px 20px}
.cta-btn{
  width:100%;padding:13px;border-radius:10px;border:none;
  background:linear-gradient(135deg,${C.orange} 0%,${C.accent} 100%);
  color:#fff;font-family:'DM Sans',sans-serif;font-weight:700;font-size:14px;
  cursor:pointer;transition:all .2s;
  display:flex;align-items:center;justify-content:center;gap:8px;
  box-shadow:0 4px 16px rgba(232,103,26,.35);
  letter-spacing:.01em;
}
.cta-btn:hover{box-shadow:0 6px 24px rgba(232,103,26,.5);transform:translateY(-1px)}
.cta-btn:disabled{background:#3D527A;box-shadow:none;cursor:not-allowed;transform:none;opacity:.7}
.cta-sub{font-size:10px;color:${C.sidebarMuted};text-align:center;margin-top:6px}
.reset-btn{
  width:100%;padding:8px;border-radius:8px;margin-top:6px;
  border:1px solid ${C.sidebarDim};background:transparent;
  color:${C.sidebarMuted};cursor:pointer;font-family:'DM Sans',sans-serif;
  font-size:11px;transition:all .15s;
}
.reset-btn:hover{color:${C.sidebarText};border-color:${C.sidebarText}}

/* Security note */
.sb-security{
  padding:10px 16px;font-size:9px;color:${C.sidebarMuted};
  display:flex;align-items:center;gap:5px;margin-top:auto;
  border-top:1px solid ${C.sidebarDim};
}

/* Content area */
.content{flex:1;display:flex;flex-direction:column;min-width:0}

/* Top bar */
.topbar{
  background:${C.surface};
  border-bottom:1px solid ${C.border};
  padding:0 28px;
  display:flex;align-items:center;
  height:56px;gap:0;
  position:sticky;top:0;z-index:50;
}
.topbar-brand{
  font-family:'Syne',sans-serif;font-weight:700;font-size:20px;
  color:${C.navy};margin-right:14px;white-space:nowrap;
}
.topbar-version{
  font-size:11px;font-weight:600;color:${C.accent};
  background:${C.accentDim};border:1px solid rgba(201,133,58,.25);
  border-radius:100px;padding:2px 9px;margin-right:auto;
  font-family:'DM Mono',monospace;
}
.topbar-credits{
  display:flex;align-items:center;gap:6px;
  font-family:'DM Mono',monospace;font-size:12px;
  color:${C.accent};font-weight:700;
  background:${C.accentDim};border:1px solid rgba(201,133,58,.2);
  border-radius:100px;padding:5px 13px;margin-right:8px;
}
.topbar-btn{
  padding:5px 13px;border-radius:100px;
  border:1px solid ${C.border};background:transparent;
  color:${C.muted};font-size:11px;cursor:pointer;
  font-family:'DM Sans',sans-serif;font-weight:600;
  transition:all .15s;margin-right:8px;
}
.topbar-btn:hover{border-color:${C.navy};color:${C.navy}}
.topbar-user{
  display:flex;align-items:center;gap:8px;
  padding:5px 12px;border-radius:100px;
  border:1px solid ${C.border};cursor:pointer;
  transition:all .15s;
}
.topbar-user:hover{border-color:${C.borderHi}}
.topbar-avatar{
  width:28px;height:28px;border-radius:50%;
  background:${C.navy};
  display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:700;color:#fff;font-family:'DM Mono',monospace;
}

/* Result header bar */
.result-hd{
  background:${C.surface};
  border-bottom:1px solid ${C.border};
  padding:0 28px;
  display:flex;align-items:center;
  min-height:52px;gap:12px;flex-wrap:wrap;
}
.result-hd-info{
  background:${C.bg};border:1px solid ${C.border};border-radius:8px;
  padding:8px 16px;display:flex;gap:24px;flex-wrap:wrap;
}
.rh-item{display:flex;flex-direction:column;gap:1px}
.rh-item-label{font-size:9px;color:${C.dim};text-transform:uppercase;letter-spacing:.08em;font-family:'DM Mono',monospace;font-weight:600}
.rh-item-val{font-size:12px;font-weight:600;color:${C.text}}

/* Tabs */
.tabs{display:flex;gap:0;border-bottom:2px solid ${C.border}}
.tab-btn{
  padding:12px 20px;border:none;background:transparent;
  font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;
  color:${C.muted};cursor:pointer;transition:all .15s;
  border-bottom:2px solid transparent;margin-bottom:-2px;
  white-space:nowrap;
}
.tab-btn.active{color:${C.navy};border-bottom-color:${C.accent}}
.tab-btn:hover:not(.active){color:${C.text}}

/* Export buttons */
.export-btn{
  display:flex;align-items:center;gap:5px;
  padding:6px 13px;border-radius:7px;
  border:1px solid ${C.border};background:${C.surface};
  color:${C.muted};font-size:11px;font-weight:600;cursor:pointer;
  font-family:'DM Sans',sans-serif;transition:all .15s;
}
.export-btn:hover{border-color:${C.navy};color:${C.navy}}

/* Main content */
.main-content{padding:24px 28px 60px;flex:1}

/* Analysis complete banner */
.analysis-banner{
  background:${C.surface};border:1px solid ${C.border};
  border-radius:12px;padding:16px 20px;
  display:flex;align-items:center;gap:16px;
  margin-bottom:20px;
}
.banner-icon{
  width:44px;height:44px;border-radius:10px;
  background:${C.accentDim};border:1px solid rgba(201,133,58,.2);
  display:flex;align-items:center;justify-content:center;
  font-size:20px;flex-shrink:0;
}
.banner-title{font-family:'Syne',sans-serif;font-weight:700;font-size:15px;color:${C.navy};margin-bottom:4px}
.banner-meta{display:flex;gap:24px;flex-wrap:wrap}
.bm-item{display:flex;flex-direction:column}
.bm-label{font-size:9px;color:${C.dim};text-transform:uppercase;letter-spacing:.08em;font-family:'DM Mono',monospace}
.bm-val{font-size:11px;font-weight:600;color:${C.text};margin-top:1px}
.banner-badge{
  margin-left:auto;font-size:10px;font-weight:700;
  background:rgba(27,42,74,.08);border:1px solid rgba(27,42,74,.15);
  color:${C.navy};border-radius:100px;padding:4px 12px;
  font-family:'DM Mono',monospace;white-space:nowrap;flex-shrink:0;
}

/* Candidate cards grid */
.candidates-grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(300px,1fr));
  gap:16px;margin-bottom:24px;
}
.cand-card{
  background:${C.surface};border:2px solid ${C.border};
  border-radius:12px;padding:20px;
  animation:fadeUp .4s cubic-bezier(.22,1,.36,1) both;
  transition:border-color .2s,box-shadow .2s;
}
.cand-card:hover{border-color:${C.borderHi};box-shadow:0 4px 20px rgba(0,0,0,.08)}
.cand-card.rank-1{border-color:rgba(201,133,58,.4)}
.cand-card.rank-2{border-color:rgba(27,42,74,.2)}
.cand-card.rank-3{border-color:${C.border}}

.cand-rank{font-size:10px;font-weight:700;color:${C.accent};
  font-family:'DM Mono',monospace;letter-spacing:.06em;margin-bottom:6px}
.cand-name{font-family:'Syne',sans-serif;font-weight:700;font-size:16px;
  color:${C.navy};margin-bottom:3px;line-height:1.2}
.cand-file{font-size:10px;color:${C.dim};font-family:'DM Mono',monospace;margin-bottom:10px}

.reco-badge{
  display:inline-flex;align-items:center;gap:5px;
  padding:4px 12px;border-radius:100px;
  font-size:10px;font-weight:700;letter-spacing:.07em;
  text-transform:uppercase;font-family:'DM Mono',monospace;
  border:1.5px solid;margin-bottom:12px;
}

/* Donut */
.donut-wrap{display:flex;align-items:center;gap:14px;margin-bottom:14px}
.donut-labels{display:flex;flex-direction:column;gap:3px}
.donut-score-label{font-size:9px;color:${C.dim};text-transform:uppercase;
  letter-spacing:.08em;font-family:'DM Mono',monospace;font-weight:600}
.donut-sub{display:flex;gap:10px;flex-wrap:wrap}
.donut-sub-item{font-size:10px;color:${C.muted}}
.donut-sub-item strong{color:${C.text}}

/* Mini stats en card */
.cand-stats{
  display:flex;gap:0;
  border:1px solid ${C.border};border-radius:8px;overflow:hidden;
  margin-bottom:12px;
}
.cand-stat{
  flex:1;padding:8px 10px;text-align:center;
  border-right:1px solid ${C.border};
}
.cand-stat:last-child{border-right:none}
.cand-stat-icon{font-size:14px;margin-bottom:2px}
.cand-stat-label{font-size:8px;color:${C.dim};text-transform:uppercase;
  letter-spacing:.07em;font-family:'DM Mono',monospace;font-weight:600}
.cand-stat-val{font-size:13px;font-weight:700;font-family:'DM Mono',monospace}

/* Strengths/gaps pills */
.pill-list{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px}
.pill{font-size:10px;padding:3px 9px;border-radius:100px;font-weight:500}
.pill.good{background:${C.greenDim};border:1px solid rgba(26,122,69,.2);color:${C.green}}
.pill.bad{background:${C.redDim};border:1px solid rgba(185,28,28,.2);color:${C.red}}

/* Detail card expand */
.expand-btn{
  width:100%;padding:7px;border-radius:7px;
  border:1px solid ${C.border};background:transparent;
  color:${C.muted};cursor:pointer;font-size:11px;
  font-family:'DM Sans',sans-serif;font-weight:600;
  transition:all .15s;margin-top:8px;
}
.expand-btn:hover{border-color:${C.navy};color:${C.navy}}

/* Detail tables */
.detail-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:12px}
.detail-table th{
  background:${C.bg};padding:8px 12px;text-align:left;
  font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  color:${C.muted};border-bottom:1px solid ${C.border};
  font-family:'DM Mono',monospace;
}
.detail-table td{padding:10px 12px;border-bottom:1px solid ${C.border};vertical-align:top;line-height:1.5}
.detail-table tr:last-child td{border-bottom:none}
.detail-table tr:hover td{background:rgba(0,0,0,.015)}
.cumple-si{color:${C.green};font-weight:700;font-size:10px;font-family:'DM Mono',monospace}
.cumple-parcial{color:${C.amber};font-weight:700;font-size:10px;font-family:'DM Mono',monospace}
.cumple-no{color:${C.red};font-weight:700;font-size:10px;font-family:'DM Mono',monospace}

/* Bottom panels */
.bottom-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:20px}
@media(max-width:1100px){.bottom-grid{grid-template-columns:1fr 1fr}}
@media(max-width:800px){.bottom-grid{grid-template-columns:1fr}}
.bp{background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:18px}
.bp-title{font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.1em;color:${C.dim};font-family:'DM Mono',monospace;
  margin-bottom:12px}

/* Recom exec panel */
.rec-exec{background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:20px}
.rec-winner{font-family:'Syne',sans-serif;font-weight:800;font-size:17px;
  color:${C.navy};margin-bottom:4px;line-height:1.2}
.rec-conf-grid{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap}
.rec-conf-item{
  flex:1;min-width:70px;
  background:${C.bg};border:1px solid ${C.border};border-radius:8px;
  padding:8px 10px;text-align:center;
}
.rec-conf-label{font-size:8px;color:${C.dim};text-transform:uppercase;
  letter-spacing:.08em;font-family:'DM Mono',monospace;font-weight:600}
.rec-conf-val{font-size:12px;font-weight:700;color:${C.text};margin-top:2px}

/* Empty state */
.empty-state{
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  min-height:70vh;text-align:center;padding:0 24px;
}
.empty-icon{
  width:80px;height:80px;border-radius:16px;
  background:${C.surface};border:1px solid ${C.border};
  display:flex;align-items:center;justify-content:center;
  font-size:32px;margin-bottom:20px;
  box-shadow:0 2px 12px rgba(0,0,0,.06);
}
.empty-title{font-family:'Syne',sans-serif;font-weight:700;font-size:22px;
  color:${C.navy};margin-bottom:8px}
.empty-sub{color:${C.muted};font-size:13px;max-width:320px;line-height:1.7;margin-bottom:24px}
.empty-pills{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.empty-pill{
  padding:5px 14px;border-radius:100px;
  font-size:11px;font-weight:600;border:1px solid;
  font-family:'DM Mono',monospace;
}

/* Loading */
.loading-box{
  background:${C.surface};border:1px solid ${C.border};border-radius:12px;
  padding:48px 32px;text-align:center;max-width:480px;margin:60px auto 0;
}
.loading-title{font-family:'Syne',sans-serif;font-weight:700;font-size:18px;
  color:${C.navy};margin:16px 0 6px}
.loading-sub{font-size:13px;color:${C.muted};margin-bottom:24px}
.progress-steps{display:flex;flex-direction:column;gap:4px;text-align:left}
.ps-item{display:flex;align-items:center;gap:8px;padding:6px 10px;
  border-radius:7px;font-size:11px;font-family:'DM Mono',monospace;transition:all .3s}
.ps-item.done{color:${C.green};background:${C.greenDim}}
.ps-item.active{color:${C.navy};background:rgba(27,42,74,.06);animation:pulse 1.2s ease infinite}
.ps-item.pending{color:${C.dim}}

/* Bar */
.bar-row{display:grid;grid-template-columns:120px 1fr 34px;align-items:center;gap:8px;margin-bottom:7px}
.bar-track{height:5px;background:${C.bg};border-radius:100px;overflow:hidden;border:1px solid ${C.border}}
.bar-fill{height:100%;border-radius:100px;transition:width 1.2s cubic-bezier(.22,1,.36,1)}
.bar-label{font-size:11px;color:${C.muted};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar-val{font-size:11px;font-family:'DM Mono',monospace;font-weight:700;text-align:right}

/* Comparativa matrix */
.matrix-table{width:100%;border-collapse:collapse;font-size:12px}
.matrix-table th{background:${C.bg};padding:9px 14px;text-align:left;
  font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  color:${C.muted};border-bottom:1px solid ${C.border};font-family:'DM Mono',monospace}
.matrix-table td{padding:11px 14px;border-bottom:1px solid ${C.border};vertical-align:middle}
.matrix-table tr:last-child td{border-bottom:none}
.matrix-table tr:hover td{background:rgba(0,0,0,.015)}

/* Spinner */
.spinner{width:28px;height:28px;border:2.5px solid ${C.border};
  border-top-color:${C.accent};border-radius:50%;animation:spin .65s linear infinite}

/* Footer */
.page-footer{
  background:${C.surface};border-top:1px solid ${C.border};
  padding:14px 28px;display:flex;align-items:center;justify-content:space-between;
  font-size:11px;color:${C.dim};font-family:'DM Mono',monospace;
}

/* Toast */
.toast{
  position:fixed;bottom:22px;right:22px;
  background:${C.navy};border-radius:10px;
  padding:11px 18px;display:flex;align-items:center;gap:9px;
  font-size:12px;color:#fff;z-index:500;
  box-shadow:0 8px 40px rgba(0,0,0,.25);max-width:300px;
  animation:slideIn .3s cubic-bezier(.22,1,.36,1) both;
}

/* Modal */
.modal-overlay{
  position:fixed;inset:0;background:rgba(17,24,39,.6);
  backdrop-filter:blur(8px);z-index:200;
  display:flex;align-items:center;justify-content:center;padding:18px;
}
.modal-box{
  background:${C.surface};border:1px solid ${C.border};
  border-radius:14px;padding:28px;max-width:380px;width:100%;
  box-shadow:0 24px 80px rgba(0,0,0,.2);
  animation:fadeUp .3s cubic-bezier(.22,1,.36,1) both;
}
.credit-card{
  background:${C.bg};border:1px solid ${C.border};
  border-radius:10px;padding:16px 12px;text-align:center;cursor:pointer;transition:all .2s;
}
.credit-card:hover{border-color:${C.accent};background:${C.accentDim}}

/* Keyframes */
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes slideIn{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:translateX(0)}}
@keyframes radarIn{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}
@keyframes pulse{0%,100%{opacity:.6}50%{opacity:1}}
@media print {
  .sidebar, .topbar, .result-hd, .export-btn, .page-footer { display:none!important; }
  .content { margin:0!important; padding:0!important; }
  .main-content { padding:12px!important; }
  .shell { display:block!important; }
  .bp { break-inside:avoid; page-break-inside:avoid; }
  .candidates-grid { grid-template-columns:1fr!important; }
  body { background:#fff!important; }
}
`

// ─── DONUT CHART SVG ──────────────────────────────────────────────────────────
function DonutChart({ score, size = 88 }) {
  const col    = scoreColor(score)
  const r      = (size - 10) / 2
  const cx     = size / 2
  const cy     = size / 2
  const circ   = 2 * Math.PI * r
  const filled = (score / 100) * circ
  const gap    = circ - filled

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', animation: 'fadeIn .6s ease both' }}>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth="8" />
      {/* Fill */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={col} strokeWidth="8"
        strokeDasharray={`${filled} ${gap}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dasharray 1s cubic-bezier(.22,1,.36,1)' }}
      />
      {/* Score text */}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="18" fontWeight="700"
        fontFamily="'DM Mono',monospace" fill={col}>{score}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="8"
        fontFamily="'DM Mono',monospace" fill={C.dim}>%</text>
    </svg>
  )
}

// ─── BAR ROW ──────────────────────────────────────────────────────────────────
function BarRow({ label, value }) {
  const col = scoreColor(value)
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <div className="bar-track"><div className="bar-fill" style={{ width:`${value}%`,background:col }}/></div>
      <span className="bar-val" style={{ color:col }}>{value}</span>
    </div>
  )
}

// ─── CUMPLE BADGE ─────────────────────────────────────────────────────────────
function CumpleBadge({ val }) {
  if (!val) return null
  if (val==='CUMPLE')             return <span className="cumple-si">✓ CUMPLE</span>
  if (val==='CUMPLE PARCIALMENTE') return <span className="cumple-parcial">◐ PARCIAL</span>
  return <span className="cumple-no">✕ NO CUMPLE</span>
}

// ─── BRECHA BADGE ─────────────────────────────────────────────────────────────
function BrechaBadge({ val }) {
  if (!val) return null
  const cfg = {
    'SIN BRECHA':   { cls:'cumple-si',      label:'SIN BRECHA' },
    'PARCIAL':      { cls:'cumple-parcial',  label:'PARCIAL' },
    'SIGNIFICATIVA':{ cls:'cumple-no',       label:'SIGNIFICATIVA' },
    'CRITICA':      { cls:'cumple-no',       label:'CRÍTICA' },
  }[val] || { cls:'cumple-no', label:val }
  return <span className={cfg.cls} style={{ fontFamily:"'DM Mono'" }}>{cfg.label}</span>
}

// ─── FILE ITEM (sidebar) ──────────────────────────────────────────────────────
function SbFileItem({ name, status, onRemove }) {
  const ext = name.split('.').pop().toUpperCase().slice(0,3)
  const extColor = ext==='PDF' ? '#E5534B' : ext==='DOC'||ext==='DOC' ? '#2B5CE6' : C.accent
  const statusIcon = { ready:'✓', ocr:'◌', error:'✗', loading:'…' }[status] || '…'
  const statusColor = { ready:C.greenLt, error:C.redLt, ocr:C.amberLt, loading:C.sidebarMuted }[status]
  return (
    <div className="sb-file">
      <div className="sb-file-icon" style={{ background:extColor }}>{ext}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div className="sb-file-name">{name}</div>
        <div style={{ fontSize:9,color:statusColor,fontFamily:"'DM Mono'" }}>{status==='ready'?'✓ Extraído correctamente':status==='loading'?'Procesando…':status==='ocr'?'OCR en curso…':'Error'}</div>
      </div>
      <span className="sb-file-status" style={{ color:statusColor }}>{statusIcon}</span>
      <button className="sb-file-del" onClick={onRemove}>×</button>
    </div>
  )
}

// ─── DROPZONE ─────────────────────────────────────────────────────────────────
function DropZone({ icon, label, hint, multiple, onFiles, inputRef }) {
  const [over, setOver] = useState(false)
  return (
    <div className={`dropzone${over?' drag':''}`}
      onDragOver={e=>{e.preventDefault();setOver(true)}}
      onDragLeave={()=>setOver(false)}
      onDrop={e=>{e.preventDefault();setOver(false);onFiles(e.dataTransfer.files)}}>
      <input ref={inputRef} type="file" accept=".txt,.pdf,.docx" multiple={multiple}
        onChange={e=>onFiles(e.target.files)} />
      <div className="dropzone-icon">{icon}</div>
      <div className="dropzone-label">{label}</div>
      <div className="dropzone-hint">{hint}</div>
    </div>
  )
}

// ─── CANDIDATE CARD ───────────────────────────────────────────────────────────
function CandidateCard({ candidate: c, idx, tab }) {
  const [expanded, setExpanded] = useState(false)
  const reco = RECO[c.recommendation] || RECO['RESERVA']
  const rankLabels = ['1°','2°','3°']
  const rankClass  = idx===0?'rank-1':idx===1?'rank-2':'rank-3'

  return (
    <div className={`cand-card ${rankClass}`} style={{ animationDelay:`${idx*.08}s` }}>
      {idx<3&&<div className="cand-rank">{rankLabels[idx]} LUGAR</div>}
      <div className="cand-name">{c.name||'Candidato'}</div>
      <div className="cand-file">{c.fileName}</div>
      <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:10 }}>
        <span className="reco-badge" style={{ color:reco.color,background:reco.bg,borderColor:reco.border }}>
          <span style={{ width:6,height:6,borderRadius:'50%',background:reco.dot,display:'inline-block' }}/>
          {reco.label}
        </span>
      </div>

      {/* Donut + resumen — layout adaptable */}
      <div className="donut-wrap" style={{ alignItems:'flex-start' }}>
        <DonutChart score={c.score} size={88} />
        <div className="donut-labels" style={{ flex:1 }}>
          <div className="donut-score-label">Match Global</div>
          {c.summary && <div style={{ fontSize:11,color:C.muted,lineHeight:1.6,maxWidth:'none' }}>{c.summary}</div>}
        </div>
      </div>

      {/* Fortalezas */}
      {c.strengths?.length>0&&(
        <div style={{ marginBottom:6 }}>
          <div style={{ fontSize:9,color:C.dim,textTransform:'uppercase',letterSpacing:'.08em',fontFamily:"'DM Mono'",fontWeight:700,marginBottom:4 }}>Fortalezas principales</div>
          <div className="pill-list">
            {c.strengths.slice(0,3).map((s,i)=>(
              <span key={i} className="pill good">
                <span style={{ marginRight:4 }}>✓</span>{s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Brechas */}
      {c.gaps?.length>0&&(
        <div style={{ marginBottom:8 }}>
          <div style={{ fontSize:9,color:C.dim,textTransform:'uppercase',letterSpacing:'.08em',fontFamily:"'DM Mono'",fontWeight:700,marginBottom:4 }}>Brechas principales</div>
          <div className="pill-list">
            {c.gaps.slice(0,2).map((g,i)=>(
              <span key={i} className="pill bad">
                <span style={{ marginRight:4 }}>✕</span>{g}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Expandir detalle */}
      <button className="expand-btn" onClick={()=>setExpanded(o=>!o)}>
        {expanded ? '▲ Ocultar detalle' : '▼ Ver detalle completo'}
      </button>

      {expanded&&(
        <div style={{ marginTop:14 }}>
          {/* Resumen ejecutivo */}
          {c.executiveSummary&&(
            <div style={{ fontSize:12,lineHeight:1.7,color:C.muted,background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,padding:'12px 14px',marginBottom:14 }}>
              {c.executiveSummary}
            </div>
          )}
          {/* Desglose curricular */}
          {c.scoreBreakdown&&(
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:9,color:C.dim,textTransform:'uppercase',letterSpacing:'.1em',fontWeight:700,fontFamily:"'DM Mono'",marginBottom:8 }}>Desglose Curricular</div>
              {Object.entries(c.scoreBreakdown).map(([k,v])=><BarRow key={k} label={k} value={v}/>)}
            </div>
          )}
          {/* Radar */}
          {c.competencies&&Object.keys(c.competencies).length>0&&(
            <div style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:'16px 12px 12px',marginBottom:14 }}>
              <div style={{ fontSize:9,color:C.dim,textTransform:'uppercase',letterSpacing:'.1em',fontWeight:700,fontFamily:"'DM Mono'",textAlign:'center',marginBottom:8 }}>Radar Competencial</div>
            </div>
          )}
          {/* Tabla matchDetail */}
          {c.matchDetail&&(
            <div style={{ overflowX:'auto',marginBottom:14 }}>
              <div style={{ fontSize:9,color:C.dim,textTransform:'uppercase',letterSpacing:'.1em',fontWeight:700,fontFamily:"'DM Mono'",marginBottom:6 }}>Contraste Perfil vs. Candidato</div>
              <table className="detail-table">
                <thead><tr><th>Criterio</th><th>Requerido</th><th>Candidato aporta</th><th>Cumple</th></tr></thead>
                <tbody>
                  {Object.entries(c.matchDetail).map(([k,v])=>(
                    <tr key={k}>
                      <td style={{ fontWeight:600,color:C.text,fontSize:11,whiteSpace:'nowrap' }}>
                        {{formacion:'Formación',experienciaGeneral:'Exp. General',experienciaEspecifica:'Exp. Específica',formacionComplementaria:'Formación Comp.',condicionesEspeciales:'Condiciones'}[k]||k}
                      </td>
                      <td style={{ color:C.muted }}>{v.requerido}</td>
                      <td style={{ color:C.text }}>{v.candidato}</td>
                      <td><CumpleBadge val={v.cumple}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      {/* Tabla comparativa */}
      <div className="bp" style={{ marginBottom:16, overflowX:'auto' }}>
        <div className="bp-title">Tabla Comparativa por Tipo de Análisis</div>
        <table className="matrix-table">
          <thead>
            <tr>
              <th>Candidato</th>
              <th>Perfil</th>
              <th>Match Global</th>
              <th>Recomendación</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row,i)=>{
              const reco = RECO[row.reco]||RECO['RESERVA']
              return (
                <tr key={i}>
                  <td>
                    <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                      <div style={{ width:22,height:22,borderRadius:6,background:i===0?C.accent:C.navy,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',fontFamily:"'DM Mono'",flexShrink:0 }}>{i+1}</div>
                      <span style={{ fontWeight:600,color:C.navy }}>{row.name}</span>
                    </div>
                  </td>
                  <td><span style={{ fontFamily:"'DM Mono'",fontWeight:700,color:scoreColor(row.p?.score||0) }}>{row.p?.score??'—'}%</span></td>
                  <td><span style={{ fontFamily:"'DM Mono'",fontWeight:700,fontSize:14,color:scoreColor(row.avg) }}>{row.avg}%</span></td>
                  <td><span className="reco-badge" style={{ color:reco.color,background:reco.bg,borderColor:reco.border }}>{reco.label}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="bottom-grid">

        {/* Matrix scores por competencia */}
        <div className="bp">
          <div className="bp-title">Ranking Final</div>
          {matrix.map((row,i)=>{
            const reco=RECO[row.reco]||RECO['RESERVA']
            return (
              <div key={i} style={{ display:'flex',alignItems:'center',gap:12,padding:'12px 0',borderBottom:i<matrix.length-1?`1px solid ${C.border}`:'none' }}>
                <DonutChart score={row.avg} size={56}/>
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontFamily:"'Syne'",fontWeight:700,fontSize:13,color:C.navy,marginBottom:3 }}>{row.name}</div>
                  <span className="reco-badge" style={{ color:reco.color,background:reco.bg,borderColor:reco.border,fontSize:9 }}>{reco.label}</span>
                </div>
              </div>
            )
          })}
          <button className="export-btn" onClick={onExportCSV} style={{ width:'100%',marginTop:14,justifyContent:'center',background:C.navy,color:'#fff',border:'none' }}>
            ⬇ Exportar CSV
          </button>
        </div>

        {/* Recomendación ejecutiva */}
        {winner&&(
          <div className="rec-exec">
            <div className="bp-title">Recomendación Ejecutiva</div>
            <div style={{ fontSize:20,marginBottom:8 }}>🏆</div>
            <div className="rec-winner">{winner.name}</div>
            <span className="reco-badge" style={{ color:winnerReco.color,background:winnerReco.bg,borderColor:winnerReco.border,marginBottom:10,display:'inline-flex' }}>
              RECOMENDADO PARA EL CARGO
            </span>
            <div style={{ fontSize:12,color:C.muted,lineHeight:1.7,marginBottom:14 }}>
              {winner.f?.executiveSummary||winner.f?.summary||winner.p?.summary||'Candidato con el mayor ajuste global al perfil requerido.'}
            </div>
            <div className="rec-conf-grid">
              {[['Confianza','ALTA'],['Nivel de ajuste','ÓPTIMO'],['Riesgo rotación','BAJO']].map(([l,v])=>(
                <div key={l} className="rec-conf-item">
                  <div className="rec-conf-label">{l}</div>
                  <div className="rec-conf-val" style={{ color:C.green }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PROFILE CARD ─────────────────────────────────────────────────────────────
function ProfileCard({ profile }) {
  if (!profile) return null
  const fields = [
    ['Cargo',         profile.nombreCargo],
    ['Área',          profile.area],
    ['Misión',        profile.mision],
    ['Formación',     profile.estudios?.nivelRequerido],
    ['Carreras',      profile.estudios?.carrerasAceptadas?.join(', ')],
    ['Exp. General',  profile.experiencia?.generalAnios],
    ['Exp. Específica',profile.experiencia?.especifica?.join(' · ')],
    ['Sectores',      profile.experiencia?.sectoresDeseados?.join(', ')],
    ['Conocimientos', profile.conocimientosTecnicos?.join(', ')],
    ['Idiomas',       profile.idiomas],
    ['Condiciones',   profile.condicionesEspeciales?.join(' · ')],
    ['Lugar',         profile.lugarTrabajo],
    ['Jornada',       profile.jornada],
  ].filter(([,v])=>v&&v!=='null')

  return (
    <div className="bp" style={{ marginBottom:16 }}>
      <div className="bp-title">📋 Cuadro Resumen — Perfil del Cargo</div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:'4px 16px' }}>
        {fields.map(([label,val])=>(
          <div key={label} style={{ display:'grid',gridTemplateColumns:'100px 1fr',gap:6,padding:'6px 0',borderBottom:`1px solid ${C.border}`,fontSize:12,alignItems:'start' }}>
            <span style={{ color:C.dim,fontFamily:"'DM Mono'",fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',paddingTop:2 }}>{label}</span>
            <span style={{ color:C.text,lineHeight:1.5 }}>{val}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [credits, setCredits]             = useState(50)
  const [jobFile, setJobFile]             = useState(null)
  const [profileData, setProfileData]     = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [cvFiles, setCvFiles]             = useState([])
  const [mode, setMode]                   = useState('profile')
  const [loading, setLoading]             = useState(false)
  const [loadMsg, setLoadMsg]             = useState('')
  const [results, setResults]             = useState(null)
  const [compareResults, setCompareResults] = useState(null)
  const [activeTab, setActiveTab]         = useState('resumen')
  const [error, setError]                 = useState('')
  const [toast, setToast]                 = useState(null)
  const [modal, setModal]                 = useState(false)
  // Historial de la sesión — acumula todos los análisis sin borrar los anteriores
  const [history, setHistory]             = useState([])   // [{id, label, results, compareResults, date, mode}]
  const [activeHistoryId, setActiveHistoryId] = useState(null)
  // Opción C: modo inteligente automático vs. personalizado
  const [showAdvanced, setShowAdvanced]   = useState(false)
  const jobRef = useRef(), cvRef = useRef()

  const notify = (icon, msg, type='s') => {
    setToast({ icon, msg, type })
    setTimeout(()=>setToast(null), 3400)
  }


  function reset() {
    setJobFile(null); setProfileData(null); setCvFiles([])
    setResults(null); setCompareResults(null); setError(''); setActiveTab('resumen')
    setActiveHistoryId(null)
    if (jobRef.current) jobRef.current.value=''
    if (cvRef.current) cvRef.current.value=''
    notify('↺','Reiniciado')
  }

  const hasResults = results||compareResults
  const candidates = results?.candidates||[]
  const analysisDate = new Date().toLocaleString('es-CL',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})

  // Variables de modo inteligente
  const ready       = cvFiles.filter(f=>f.status==='ready')
  const smartMode   = ready.length >= 2 ? 'compare' : 'profile'
  const smartLabel  = ready.length >= 2 ? 'Vista Comparativa' : 'Análisis de Perfil'
  const smartIcon   = ready.length >= 2 ? '⚡' : '📋'
  const smartCost   = (MODES.find(m=>m.id===smartMode)?.cost||2) * Math.max(ready.length,1)
  const smartDesc   = ready.length >= 2
    ? `${ready.length} candidatos — ranking curricular comparativo`
    : '1 candidato — análisis curricular contra el perfil'
  const effectiveMode = showAdvanced ? mode : smartMode
  const totalCost   = showAdvanced
    ? (MODES.find(m=>m.id===mode)?.cost||2) * Math.max(ready.length,1)
    : smartCost
  const canAnalyze  = jobFile?.status==='ready' && ready.length>0 && !loading

  const LOAD_STEPS = {
    profile: ['Procesando documentos','Contrastando perfil','Generando evaluación'],
    compare: ['Analizando candidatos','Generando ranking','Completando comparativa'],
  }
  const steps   = LOAD_STEPS[effectiveMode] || LOAD_STEPS.profile
  const stepIdx = Math.max(0, steps.findIndex(s=>loadMsg.toLowerCase().includes(s.split(' ')[0].toLowerCase())))

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <div className="shell">

        {/* ══ SIDEBAR NAVY ══════════════════════════════════════════════════════ */}
        <aside className="sidebar">

          {/* Logo */}
          <div className="sb-header">
            <div className="sb-logo">G</div>
            <div style={{ fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,color:C.sidebarText }}>
              #MatchVia<span style={{ color:C.accent }}>Geperex</span>
            </div>
          </div>

          {/* Step 1 — Perfil */}
          <div className="sb-section">
            <div className="sb-section-title">
              <div className="sb-step navy">1</div>
              <div>
                <div className="sb-label">Perfil del Cargo</div>
                <div className="sb-sublabel">Define el perfil objetivo</div>
              </div>
              {profileData&&!profileLoading&&(
                <span style={{ marginLeft:'auto',fontSize:9,fontWeight:700,color:C.greenLt,background:'rgba(34,160,90,.15)',border:'1px solid rgba(34,160,90,.3)',borderRadius:100,padding:'2px 8px',fontFamily:"'DM Mono'",flexShrink:0 }}>LISTO</span>
              )}
            </div>
            {!jobFile ? (
              <DropZone icon="📄" label="Subir Perfil de Cargo" hint="PDF, DOCX o TXT" multiple={false} onFiles={handleJobFiles} inputRef={jobRef}/>
            ) : (
              <SbFileItem name={jobFile.name} status={jobFile.status} onRemove={()=>{ setJobFile(null); setProfileData(null); if(jobRef.current)jobRef.current.value='' }}/>
            )}
            {profileLoading&&(
              <div style={{ display:'flex',alignItems:'center',gap:6,marginTop:6 }}>
                <div className="spinner" style={{ width:10,height:10,borderWidth:1.5 }}/>
                <span style={{ fontSize:9,color:C.sidebarMuted,fontFamily:"'DM Mono'" }}>Extrayendo estructura…</span>
              </div>
            )}
            {profileData&&!profileLoading&&(
              <div style={{ fontSize:9,color:C.greenLt,fontFamily:"'DM Mono'",marginTop:4 }}>✓ Estructura extraída</div>
            )}
          </div>

          {/* Step 2 — CVs */}
          <div className="sb-section">
            <div className="sb-section-title">
              <div className="sb-step" style={{ background:C.accent }}>2</div>
              <div>
                <div className="sb-label">Candidatos</div>
                <div className="sb-sublabel">Sube los CVs a analizar</div>
              </div>
              {cvFiles.length>0&&(
                <span style={{ marginLeft:'auto',fontSize:9,fontWeight:700,color:C.accent,background:'rgba(201,133,58,.15)',border:'1px solid rgba(201,133,58,.3)',borderRadius:100,padding:'2px 8px',fontFamily:"'DM Mono'",flexShrink:0 }}>{cvFiles.length} archivos</span>
              )}
            </div>
            <DropZone icon="👥" label="Subir CVs" hint="PDF, DOCX o TXT" multiple={true} onFiles={handleCvFiles} inputRef={cvRef}/>
            {cvFiles.length>0&&(
              <div style={{ marginTop:8,display:'flex',flexDirection:'column',gap:0,maxHeight:120,overflowY:'auto' }}>
                {cvFiles.map((cv,i)=>(
                  <SbFileItem key={i} name={cv.name} status={cv.status} onRemove={()=>setCvFiles(p=>p.filter((_,j)=>j!==i))}/>
                ))}
              </div>
            )}
          </div>

          {/* Step 3 — Modo inteligente automático */}
          {!showAdvanced ? (
            // ── MODO AUTOMÁTICO (default) ──
            <div className="sb-section">
              <div className="sb-section-title">
                <div className="sb-step navy">3</div>
                <div>
                  <div className="sb-label">Análisis</div>
                  <div className="sb-sublabel">Modo automático activo</div>
                </div>
              </div>
              {/* Card del modo detectado */}
              <div style={{
                background:'rgba(255,255,255,.05)',
                border:`1px solid ${C.accent}40`,
                borderRadius:9, padding:'11px 12px',
                marginBottom:8,
              }}>
                <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:4 }}>
                  <span style={{ fontSize:16 }}>{smartIcon}</span>
                  <span style={{ fontSize:12,fontWeight:700,color:C.sidebarText }}>{smartLabel}</span>
                  <span style={{ marginLeft:'auto',fontFamily:"'DM Mono'",fontSize:10,fontWeight:700,
                    color:C.accent,background:'rgba(201,133,58,.15)',border:'1px solid rgba(201,133,58,.3)',
                    borderRadius:100,padding:'2px 8px',flexShrink:0 }}>
                    {smartCost} cr
                  </span>
                </div>
                <div style={{ fontSize:10,color:C.sidebarMuted,lineHeight:1.5 }}>
                  {ready.length === 0
                    ? 'Sube CVs para ver qué análisis se ejecutará'
                    : smartDesc
                  }
                </div>
                {ready.length > 0 && (
                  <div style={{ marginTop:8,display:'flex',alignItems:'center',gap:5,
                    fontSize:9,color:C.greenLt,fontFamily:"'DM Mono'" }}>
                    <span>✓</span>
                    {ready.length===1
                      ? '1 CV detectado → Análisis de Perfil'
                      : `${ready.length} CVs detectados → Vista Comparativa`
                    }
                  </div>
                )}
              </div>
              {/* Enlace personalizar */}
              <button onClick={()=>setShowAdvanced(true)} style={{
                background:'none',border:'none',cursor:'pointer',
                fontSize:10,color:C.sidebarMuted,fontFamily:"'DM Sans'",
                display:'flex',alignItems:'center',gap:4,padding:'2px 0',
                transition:'color .15s',
              }}>
                <span style={{ fontSize:10 }}>⚙</span> Personalizar análisis
              </button>
            </div>
          ) : (
            // ── MODO AVANZADO (personalizado) ──
            <div className="sb-section">
              <div className="sb-section-title">
                <div className="sb-step navy">3</div>
                <div>
                  <div className="sb-label">Tipo de Análisis</div>
                  <div className="sb-sublabel">Modo personalizado</div>
                </div>
                <button onClick={()=>setShowAdvanced(false)} style={{
                  marginLeft:'auto',background:'none',border:'none',cursor:'pointer',
                  fontSize:9,color:C.accent,fontFamily:"'DM Mono'",fontWeight:700,
                  padding:'2px 6px',flexShrink:0,
                }}>← Auto</button>
              </div>
              {MODES.map(m=>(
                <div key={m.id}
                  className={`mode-item${mode===m.id?' active':''}`}
                  onClick={()=>setMode(m.id)}
                  style={{ position:'relative' }}
                  title={m.tooltip}
                >
                  <div className={`mode-radio${mode===m.id?' on':''}`}/>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:5 }}>
                      <span style={{ fontSize:13 }}>{m.icon}</span>
                      <span className="mode-label">{m.label}</span>
                    </div>
                    <div className="mode-sub">{m.desc}</div>
                  </div>
                  <span className="mode-cost">{m.cost}cr</span>
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="cta-wrap">
            <button className="cta-btn" onClick={analyze} disabled={!canAnalyze||loading}>
              {loading ? (
                <>
                  <div className="spinner" style={{ width:16,height:16,borderWidth:2,borderColor:'rgba(255,255,255,.3)',borderTopColor:'#fff' }}/>
                  Analizando…
                </>
              ) : canAnalyze ? (
                <>{smartIcon} Analizar {ready.length > 1 ? `${ready.length} Candidatos` : 'Candidato'}</>
              ) : (
                <>🚀 Analizar Candidatos</>
              )}
            </button>
            {canAnalyze&&!loading&&(
              <div className="cta-sub">
                {showAdvanced
                  ? `Modo: ${MODES.find(m=>m.id===mode)?.label} · ${totalCost} cr`
                  : `${smartLabel} · ${totalCost} cr`
                }
              </div>
            )}
            <button className="reset-btn" onClick={reset}>↺ Nuevo proceso</button>
            {error&&(
              <div style={{ marginTop:8,background:'rgba(185,28,28,.15)',border:'1px solid rgba(185,28,28,.3)',borderRadius:8,padding:'8px 10px',fontSize:10,color:'#FCA5A5',lineHeight:1.5 }}>⚠ {error}</div>
            )}
          </div>

          {/* Historial de sesión */}
          {history.length > 0 && (
            <div className="sb-section" style={{ padding:'10px 14px' }}>
              <div style={{ fontSize:9,fontWeight:700,color:C.sidebarMuted,textTransform:'uppercase',letterSpacing:'.08em',fontFamily:"'DM Mono'",marginBottom:8,display:'flex',alignItems:'center',gap:5 }}>
                🕓 Análisis de esta sesión
              </div>
              <div style={{ display:'flex',flexDirection:'column',gap:4,maxHeight:160,overflowY:'auto' }}>
                {history.map(item=>(
                  <button key={item.id}
                    onClick={()=>loadFromHistory(item)}
                    style={{
                      width:'100%',textAlign:'left',padding:'7px 9px',
                      borderRadius:7,border:`1px solid ${activeHistoryId===item.id ? C.accent+'60' : C.sidebarDim}`,
                      background: activeHistoryId===item.id ? 'rgba(201,133,58,.12)' : 'rgba(255,255,255,.03)',
                      cursor:'pointer',transition:'all .15s',
                    }}
                  >
                    <div style={{ fontSize:10,fontWeight:600,color:activeHistoryId===item.id ? C.accent : C.sidebarText,
                      whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
                      {item.mode==='compare' ? '⚡' : '📋'} {item.label}
                    </div>
                    <div style={{ fontSize:9,color:C.sidebarMuted,fontFamily:"'DM Mono'",marginTop:2 }}>{item.date}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Security note */}
          <div className="sb-security">
            🔒 Tus datos están protegidos y son confidenciales
          </div>

        </aside>

        {/* ══ CONTENT ═══════════════════════════════════════════════════════════ */}
        <div className="content">

          {/* Top bar */}
          <div className="topbar">
            <div className="topbar-brand">MatchViaGeperex</div>
            <div className="topbar-version">v8.0</div>
            <div className="topbar-credits">🏅 {credits} créditos disponibles</div>
            <button className="topbar-btn" onClick={()=>setModal(true)}>?</button>
            <div className="topbar-user">
              <div className="topbar-avatar">G</div>
              <div style={{ display:'flex',flexDirection:'column' }}>
                <span style={{ fontSize:11,fontWeight:700,color:C.text }}>Geperex Limitada</span>
              </div>
            </div>
          </div>

          {/* Tabs + Export — solo cuando hay resultados */}
          {hasResults&&(
            <div className="result-hd">
              <div className="tabs" style={{ flex:1,border:'none',borderBottom:'none' }}>
                {TABS.filter(t=>{
                  // Si solo hay compareResults, mostrar SOLO la tab comparativa
                  if (!results && compareResults) return t.id === 'comparativa'
                  // Si hay results, mostrar todas menos comparativa (a menos que también haya compareResults)
                  if (t.id === 'comparativa') return !!compareResults
                  return true
                }).map(t=>(
                  <button key={t.id}
                    className={`tab-btn${activeTab===t.id?' active':''}`}
                    onClick={()=>setActiveTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div style={{ display:'flex',gap:8,flexShrink:0 }}>
                <button className="export-btn" onClick={()=>window.print()}>📄 Exportar PDF</button>
                <button className="export-btn" onClick={exportCSV}>📊 Exportar CSV</button>
              </div>
            </div>
          )}

          {/* Main content */}
          <div className="main-content">

            {/* Loading */}
            {loading&&(
              <div className="loading-box">
                <div className="spinner" style={{ margin:'0 auto' }}/>
                <div className="loading-title">Procesando análisis</div>
                <div className="loading-sub">{loadMsg||'Iniciando…'}</div>
                <div className="progress-steps">
                  {steps.map((s,i)=>(
                    <div key={i} className={`ps-item ${i<stepIdx?'done':i===stepIdx?'active':'pending'}`}>
                      <span>{i<stepIdx?'✓':i===stepIdx?'›':'○'}</span>{s}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── RESULTADOS ── */}
            {!loading&&hasResults&&(
              <>
                {/* Banner análisis completado */}
                {results&&activeTab==='resumen'&&(
                  <div className="analysis-banner">
                    <div className="banner-icon">📋</div>
                    <div style={{ flex:1 }}>
                      <div className="banner-title">ANÁLISIS COMPLETADO</div>
                      <div className="banner-meta">
                        <div className="bm-item"><span className="bm-label">Perfil analizado</span><span className="bm-val">{profileData?.nombreCargo||jobFile?.name||'—'}</span></div>
                        <div className="bm-item"><span className="bm-label">Candidatos</span><span className="bm-val">{candidates.length}</span></div>
                        <div className="bm-item"><span className="bm-label">Fecha</span><span className="bm-val">{analysisDate}</span></div>
                        <div className="bm-item"><span className="bm-label">Tipo</span><span className="bm-val">{MODES.find(m=>m.id===results.mode)?.label}</span></div>

                      </div>
                    </div>
                    <div style={{ display:'flex',flexDirection:'column',gap:6,alignItems:'flex-end',flexShrink:0 }}>
                      <div className="banner-badge">IA + Criterio Experto</div>
                    </div>
                  </div>
                )}

                {/* ── ESTADOS INFORMATIVOS: tabs sin contenido cuando solo hay Vista Comparativa ── */}
                {!results && compareResults && activeTab !== 'comparativa' && (
                  <div style={{
                    display:'flex', flexDirection:'column', alignItems:'center',
                    justifyContent:'center', minHeight:'50vh', textAlign:'center', padding:'0 32px'
                  }}>
                    {/* Icono según tab */}
                    <div style={{
                      width:72, height:72, borderRadius:16,
                      background: activeTab==='resumen' ? C.accentDim : `rgba(26,122,69,.08)`,
                      border:`1px solid ${activeTab==='resumen' ? C.accent+'30' : C.green+'25'}`,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:30, marginBottom:20,
                    }}>
                      {activeTab==='resumen' ? '📋' : '🔍'}
                    </div>

                    <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18, color:C.navy, marginBottom:8 }}>
                      {activeTab==='resumen'  && 'Vista de Resumen no disponible'}

                      {activeTab==='detalle'  && 'Vista de Detalle no disponible'}
                    </div>

                    <div style={{ color:C.muted, fontSize:13, maxWidth:380, lineHeight:1.7, marginBottom:24 }}>
                      {activeTab==='resumen' && (
                        <>
                          Ejecutaste una <strong style={{ color:C.navy }}>Vista Comparativa</strong>. Para ver el resumen individual de un candidato, ejecuta un <strong style={{ color:C.accent }}>Análisis de Perfil</strong>.
                        </>
                      )}
                      {activeTab==='detalle' && (
                        <>
                          Esta vista muestra el detalle curricular completo. Para acceder, ejecuta un <strong style={{ color:C.accent }}>Análisis de Perfil</strong>.
                        </>
                      )}
                    </div>

                    {/* Botón para ir a comparativa */}
                    <button
                      onClick={()=>setActiveTab('comparativa')}
                      style={{
                        padding:'10px 24px', borderRadius:9,
                        background:C.navy, color:'#fff', border:'none',
                        fontFamily:"'DM Sans'", fontWeight:700, fontSize:13,
                        cursor:'pointer', transition:'all .2s',
                        boxShadow:`0 4px 16px rgba(27,42,74,.25)`,
                        display:'flex', alignItems:'center', gap:8,
                      }}
                    >
                      ⚡ Ver Vista Comparativa
                    </button>

                    {/* Sugerencia secundaria */}
                    <div style={{ marginTop:16, fontSize:11, color:C.dim, fontFamily:"'DM Mono'" }}>
                      O selecciona otro tipo de análisis en el panel izquierdo y presiona Analizar
                    </div>
                  </div>
                )}

                {/* Tab: Resumen Ejecutivo */}
                {activeTab==='resumen'&&results&&(
                  <>
                    <div className="candidates-grid" style={{
                      gridTemplateColumns: candidates.length===1
                        ? '1fr'
                        : candidates.length===2
                          ? '1fr 1fr'
                          : 'repeat(auto-fill,minmax(300px,1fr))'
                    }}>
                      {candidates.map((c,i)=><CandidateCard key={i} candidate={c} idx={i} tab={activeTab}/>)}
                    </div>
                    {/* Panel inferior: radar + recomendación */}
                    {candidates.length>1&&(
                      <div className="bottom-grid">
                        {/* Radares */}
                        {candidates.filter(c=>c.competencies&&Object.keys(c.competencies).length>0).slice(0,2).map((c,i)=>(
                          <div key={i} className="bp">
                            <div className="bp-title">Radar — {c.name}</div>
                          </div>
                        ))}
                        {/* Recomendación del top candidato */}
                        {candidates[0]&&(
                          <div className="rec-exec">
                            <div className="bp-title">Recomendación Ejecutiva</div>
                            <div style={{ fontSize:22,marginBottom:8 }}>🏆</div>
                            <div className="rec-winner">{candidates[0].name}</div>
                            <span className="reco-badge" style={{ color:RECO[candidates[0].recommendation]?.color||C.green,background:RECO[candidates[0].recommendation]?.bg||C.greenDim,borderColor:RECO[candidates[0].recommendation]?.border||C.greenLt,marginBottom:10,display:'inline-flex' }}>
                              {RECO[candidates[0].recommendation]?.label||'RECOMENDADO'}
                            </span>
                            <div style={{ fontSize:12,color:C.muted,lineHeight:1.7,marginBottom:14 }}>
                              {candidates[0].executiveSummary||candidates[0].summary}
                            </div>
                            <div className="rec-conf-grid">
                              {[['Confianza análisis','ALTA'],['Nivel de ajuste','ÓPTIMO'],['Riesgo de rotación','BAJO']].map(([l,v])=>(
                                <div key={l} className="rec-conf-item">
                                  <div className="rec-conf-label">{l}</div>
                                  <div className="rec-conf-val" style={{ color:C.green }}>{v}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
                {/* Tab: Detalle */}
                {activeTab==='detalle'&&results&&(
                  <div>
                    {profileData&&<ProfileCard profile={profileData}/>}
                    <div style={{
                      display:'grid', gap:16,
                      gridTemplateColumns: candidates.length===1
                        ? '1fr'
                        : candidates.length===2
                          ? '1fr 1fr'
                          : 'repeat(auto-fill,minmax(300px,1fr))'
                    }}>
                      {candidates.map((c,i)=><CandidateCard key={i} candidate={c} idx={i} tab="detalle"/>)}
                    </div>
                  </div>
                )}

                {/* Tab: Comparativa */}
                {activeTab==='comparativa'&&compareResults&&(
                  <ComparativePanel compareResults={compareResults} onExportCSV={exportCSV}/>
                )}
              </>
            )}

            {/* Estado vacío */}
            {!loading&&!hasResults&&(
              <div className="empty-state">
                <div className="empty-icon">◈</div>
                <div className="empty-title">Listo para analizar</div>
                <div className="empty-sub">Sube el perfil del cargo y los CVs desde el panel izquierdo, selecciona el tipo de análisis y presiona Analizar.</div>
                <div className="empty-pills">
                  {[{label:'Análisis de Perfil',col:C.navy},{label:'Vista Comparativa',col:C.amber}].map(({label,col})=>(
                    <span key={label} className="empty-pill" style={{ color:col,borderColor:`${col}30`,background:`${col}08` }}>{label}</span>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="page-footer">
            <span>Geperex Limitada · RUT 78.110.793-K · Todos los derechos reservados</span>
            <span>Powered by <strong style={{ color:C.navy }}>Geperex Intelligence</strong> 🧠</span>
          </div>
        </div>
      </div>

      {/* Modal créditos */}
      {modal&&(
        <div className="modal-overlay" onClick={e=>{ if(e.target===e.currentTarget)setModal(false) }}>
          <div className="modal-box">
            <div style={{ fontFamily:"'Syne'",fontWeight:700,fontSize:18,marginBottom:6,color:C.navy }}>Recargar Créditos</div>
            <div style={{ color:C.muted,fontSize:12,lineHeight:1.6,marginBottom:18 }}>Selecciona el paquete para tu proceso de selección.</div>
            <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16 }}>
              {[[50,'$4.990'],[150,'$12.990'],[500,'$34.990']].map(([amt,price])=>(
                <div key={amt} className="credit-card" onClick={()=>{ setCredits(c=>c+amt); setModal(false); notify('⬡',`+${amt} créditos añadidos`) }}>
                  <div style={{ fontFamily:"'DM Mono'",fontWeight:700,fontSize:24,color:C.accent }}>{amt}</div>
                  <div style={{ fontSize:9,color:C.dim,marginTop:1,fontFamily:"'DM Mono'" }}>créditos</div>
                  <div style={{ fontSize:12,color:C.muted,marginTop:6,fontWeight:500 }}>{price}</div>
                </div>
              ))}
            </div>
            <button onClick={()=>setModal(false)} style={{ width:'100%',padding:'9px',borderRadius:8,border:`1px solid ${C.border}`,background:'transparent',color:C.muted,cursor:'pointer',fontFamily:"'DM Sans'",fontWeight:600,fontSize:12 }}>Cerrar</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast&&(
        <div className="toast" style={{ background:toast.type==='e'?C.red:C.navy }}>
          <span>{toast.icon}</span><span style={{ fontSize:12 }}>{toast.msg}</span>
        </div>
      )}
    </>
  )
}
