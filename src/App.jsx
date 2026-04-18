import { useState, useRef } from 'react'
import { extractText } from './extractor.js'

// ─── DESIGN TOKENS — GEPEREX BRAND ───────────────────────────────────────────
// Paleta: Azul marino #1B2A4A · Dorado #C9853A · Blanco #F5F6F8
const C = {
  bg:        '#F5F6F8',
  bgAlt:     '#ECEEF2',
  surface:   '#FFFFFF',
  card:      '#FFFFFF',
  cardHi:    '#F8F9FA',
  border:    '#E2E5EA',
  borderHi:  '#C8CDD6',
  // Acento principal → Dorado Geperex
  accent:    '#C9853A',
  accentLt:  '#DFA05A',
  accentDim: 'rgba(201,133,58,0.10)',
  accentGlow:'rgba(201,133,58,0.15)',
  // Navy Geperex → para headers, badges, fondos secundarios
  navy:      '#1B2A4A',
  navyLt:    '#243660',
  navyDim:   'rgba(27,42,74,0.08)',
  // Semáforos — usando variantes del brand
  gold:      '#C9853A',
  goldLt:    '#DFA05A',
  goldDim:   'rgba(201,133,58,0.10)',
  green:     '#1A6B3C',
  greenLt:   '#1E8449',
  greenDim:  'rgba(26,107,60,0.10)',
  red:       '#A61C1C',
  redLt:     '#C0392B',
  redDim:    'rgba(166,28,28,0.10)',
  amber:     '#C9853A',
  amberLt:   '#DFA05A',
  amberDim:  'rgba(201,133,58,0.10)',
  purple:    '#1B2A4A',
  purpleLt:  '#243660',
  purpleDim: 'rgba(27,42,74,0.08)',
  teal:      '#1A6B3C',
  tealLt:    '#1E8449',
  tealDim:   'rgba(26,107,60,0.10)',
  text:      '#111827',
  muted:     '#4B5563',
  dim:       '#9CA3AF',
  dimHi:     '#6B7280',
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

// ─── PROMPT: EXTRACCIÓN DICCIONARIO DE COMPETENCIAS (Fase 1 - modo competencias)
const PROMPT_EXTRACT_COMPETENCIES = `Eres un experto en diseño de diccionarios de competencias para sectores de alta exigencia en Chile. Metodología: #MatchViaGeperex de GEPEREX LIMITADA.

TAREA: Lee el documento de perfil de cargo y extrae TODAS las competencias requeridas para el cargo.
Incluye competencias técnicas (hard skills) y conductuales (soft skills/blandas).
Infiere competencias implícitas que el cargo claramente necesita aunque no estén explicitadas.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin backticks:
{
  "nombreCargo": "Título exacto del cargo",
  "competencias": [
    {
      "nombre": "Nombre de la competencia",
      "tipo": "CONDUCTUAL",
      "definicion": "Definición de la competencia en el contexto de este cargo (1-2 oraciones)",
      "nivelRequerido": "ALTO",
      "indicadores": [
        "Comportamiento observable o indicador conductual 1",
        "Indicador 2"
      ],
      "fuente": "EXPLICITA"
    }
  ]
}
tipo: "CONDUCTUAL" | "TECNICA" | "LIDERAZGO" | "GESTION"
nivelRequerido: "BASICO" | "INTERMEDIO" | "ALTO" | "CRITICO"
fuente: "EXPLICITA" (mencionada en el documento) | "INFERIDA" (implícita por el cargo/funciones)
Extrae mínimo 5 y máximo 10 competencias. Solo JSON válido.`

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

  competencies: `Eres un experto senior en evaluación de competencias para sectores de alta exigencia en Chile. Metodología: #MatchViaGeperex de GEPEREX LIMITADA.

MODO: ANÁLISIS DE COMPETENCIAS — FASE 2 (CONTRASTE)
Se te entregará:
  1. DICCIONARIO DE COMPETENCIAS del cargo (ya extraído con definiciones, niveles requeridos e indicadores)
  2. Uno o más CVs de candidatos

Tu tarea es:
  a) Para CADA competencia del diccionario, buscar evidencias CONCRETAS en el CV (experiencias, logros, roles, formación)
  b) Puntuar el nivel del candidato en esa competencia versus el nivel requerido por el cargo
  c) Registrar la evidencia textual encontrada o indicar ausencia de evidencia

CRITERIO DE SCORING POR COMPETENCIA:
  - Evidencia directa y sólida + nivel igual o superior al requerido → 85-100
  - Evidencia parcial o nivel inferior al requerido → 55-84
  - Sin evidencia observable en el CV → 0-54

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin backticks:
{
  "candidates": [
    {
      "name": "Nombre completo del candidato (extráelo del CV; si no aparece, usa nombre del archivo sin extensión)",
      "fileName": "archivo.pdf",
      "score": 78,
      "recommendation": "RESERVA",
      "summary": "Evaluación de 2-3 oraciones sobre el perfil competencial del candidato versus el cargo",
      "strengths": ["fortaleza competencial concreta 1", "fortaleza 2"],
      "gaps": ["brecha competencial concreta 1", "brecha 2"],
      "competencies": {
        "NombreCompetencia1": 85,
        "NombreCompetencia2": 70
      },
      "competencyContrast": [
        {
          "competencia": "Nombre exacto de la competencia del diccionario",
          "nivelRequerido": "ALTO",
          "nivelObservado": "INTERMEDIO",
          "score": 68,
          "evidencia": "Descripción concreta de qué se encontró en el CV que evidencia (o no) esta competencia. Si no hay evidencia, indicar explícitamente.",
          "brecha": "PARCIAL"
        }
      ]
    }
  ]
}
recommendation: "CONTRATAR" | "RESERVA" | "NO RECOMENDAR"
nivelObservado: "NO OBSERVABLE" | "BASICO" | "INTERMEDIO" | "ALTO" | "CRITICO"
brecha: "SIN BRECHA" | "PARCIAL" | "SIGNIFICATIVA" | "CRITICA"
score y competencies de 0 a 100. Ordena candidatos por score descendente. Solo JSON válido.`,

  full: `Eres un experto senior en selección estratégica de personas para sectores de alta exigencia en Chile. Metodología: #MatchViaGeperex de GEPEREX LIMITADA.

MODO: ANÁLISIS 360° GLOBAL — INTEGRACIÓN TOTAL
Este modo contiene los dos análisis anteriores integrados en un único resultado:

BLOQUE 1 — ANÁLISIS DE PERFIL CURRICULAR
  Se te entregará el CUADRO RESUMEN ESTRUCTURADO del cargo.
  Evalúa formación, experiencia general, experiencia específica, condiciones especiales.
  Genera matchDetail con: requerido vs. candidato vs. cumple (CUMPLE / CUMPLE PARCIALMENTE / NO CUMPLE).
  Ponderación: Formación Académica 30% · Experiencia General 25% · Experiencia Específica 25% · Complementaria 10% · Condiciones 10%.

BLOQUE 2 — ANÁLISIS DE COMPETENCIAS
  Se te entregará el DICCIONARIO DE COMPETENCIAS del cargo (con definiciones y niveles requeridos).
  Para cada competencia, busca evidencia concreta en el CV y puntúa el nivel observado.
  Genera competencyContrast con: competencia · nivelRequerido · nivelObservado · evidencia · score · brecha.

INTEGRACIÓN FINAL
  scoreProfile = score del Bloque 1 (0-100)
  scoreCompetencies = score del Bloque 2 (0-100)
  score = (scoreProfile * 0.60) + (scoreCompetencies * 0.40)
  Genera un executiveSummary que integre ambos análisis con justificación de la recomendación.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin backticks:
{
  "candidates": [
    {
      "name": "Nombre completo del candidato (extráelo del CV; si no aparece, usa nombre del archivo sin extensión)",
      "fileName": "archivo.pdf",
      "score": 85,
      "scoreProfile": 83,
      "scoreCompetencies": 88,
      "recommendation": "CONTRATAR",
      "executiveSummary": "Párrafo ejecutivo de 4-5 oraciones que integra la evaluación curricular y competencial, justificando la recomendación con argumentos concretos de ambos bloques",
      "summary": "Síntesis de 2 oraciones para tabla comparativa",
      "strengths": ["fortaleza curricular o competencial concreta 1", "fortaleza 2", "fortaleza 3", "fortaleza 4"],
      "gaps": ["brecha curricular o competencial concreta 1", "brecha 2"],
      "riskFactors": ["factor de riesgo o punto de atención a considerar"],
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
        "Experiencia General": 85,
        "Experiencia Específica": 75,
        "Formación Complementaria": 70,
        "Condiciones Especiales": 90
      },
      "competencies": {
        "NombreCompetencia1": 90,
        "NombreCompetencia2": 85,
        "NombreCompetencia3": 78
      },
      "competencyContrast": [
        {
          "competencia": "Nombre exacto de la competencia del diccionario",
          "nivelRequerido": "ALTO",
          "nivelObservado": "INTERMEDIO",
          "score": 68,
          "evidencia": "Descripción concreta de qué se encontró en el CV que evidencia (o no) esta competencia",
          "brecha": "PARCIAL"
        }
      ]
    }
  ]
}
recommendation: "CONTRATAR" | "RESERVA" | "NO RECOMENDAR"
cumple: "CUMPLE" | "CUMPLE PARCIALMENTE" | "NO CUMPLE"
nivelObservado: "NO OBSERVABLE" | "BASICO" | "INTERMEDIO" | "ALTO" | "CRITICO"
brecha: "SIN BRECHA" | "PARCIAL" | "SIGNIFICATIVA" | "CRITICA"
score y scoreBreakdown y competencies de 0 a 100. Ordena candidatos por score descendente. Solo JSON válido.`
}

// ─── MODOS ────────────────────────────────────────────────────────────────────
const MODES = [
  { id: 'profile',      label: 'Análisis de Perfil',    icon: '📋', cost: 2, color: C.navy,    desc: 'Compatibilidad curricular vs. cargo' },
  { id: 'competencies', label: 'Análisis Competencias', icon: '🧠', cost: 2, color: C.accent,  desc: 'Mapa competencial extraído del perfil' },
  { id: 'full',         label: 'Análisis 360° Global',  icon: '🔬', cost: 3, color: C.navy,    desc: 'Curricular + competencias + recomendación' },
  { id: 'compare',      label: 'Vista Comparativa',     icon: '⚡', cost: 5, color: C.navy,    desc: '3 análisis en paralelo + Radar + CSV' },
]

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const scoreColor = v => v >= 75 ? C.navy : v >= 50 ? C.accent : C.redLt
const RECO_CFG = {
  'CONTRATAR':     { color: C.greenLt,  bg: C.greenDim,  border: `${C.green}40`, icon: '✓', label: 'CONTRATAR' },
  'RESERVA':       { color: C.amberLt,  bg: C.amberDim,  border: `${C.amber}35`, icon: '◐', label: 'RESERVA' },
  'NO RECOMENDAR': { color: C.redLt,    bg: C.redDim,    border: `${C.red}35`,   icon: '✕', label: 'NO RECOMENDAR' },
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{background:${C.bg};color:${C.text};font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}

/* Scrollbar */
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${C.borderHi};border-radius:2px}
::-webkit-scrollbar-thumb:hover{background:${C.borderHi}}

/* BG grid técnico */
.bg-grid{
  position:fixed;inset:0;z-index:0;pointer-events:none;
  background-image:
    linear-gradient(${C.border}55 1px,transparent 1px),
    linear-gradient(90deg,${C.border}55 1px,transparent 1px);
  background-size:48px 48px;
  mask-image:radial-gradient(ellipse 80% 70% at 50% 0%,#000 30%,transparent 100%);
  opacity:.18;
}
.bg-glow{
  position:fixed;top:-120px;left:50%;transform:translateX(-50%);
  width:700px;height:300px;border-radius:50%;
  background:radial-gradient(ellipse,rgba(27,42,74,0.06) 0%,transparent 65%);
  z-index:0;pointer-events:none;filter:blur(40px);
}

/* Layout */
.app-shell{
  display:grid;
  grid-template-columns:280px 1fr;
  gap:0;
  min-height:100vh;
  position:relative;z-index:5;
}
@media(max-width:860px){
  .app-shell{grid-template-columns:1fr;grid-template-rows:auto 1fr}
}

/* Sidebar */
.sidebar{
  position:sticky;top:57px;height:calc(100vh - 57px);
  overflow-y:auto;overflow-x:hidden;
  border-right:1px solid ${C.border};
  padding:14px 12px 24px;
  display:flex;flex-direction:column;gap:10px;
  background:${C.surface};
  box-shadow:2px 0 12px rgba(0,0,0,.04);
}
.sidebar::-webkit-scrollbar{width:3px}
.sidebar::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}

/* Content */
.content{
  padding:28px 24px 80px;
  overflow-x:hidden;
}

/* Keyframes */
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes slideIn{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:translateX(0)}}
@keyframes radarIn{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}
@keyframes progressBar{from{width:0%}to{width:100%}}
@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes countUp{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}

.fade-up{animation:fadeUp .4s cubic-bezier(.22,1,.36,1) both}
.fade-in{animation:fadeIn .3s ease both}
.slide-in{animation:slideIn .3s cubic-bezier(.22,1,.36,1) both}

/* Cards */
.panel{
  background:${C.card};
  border:1px solid ${C.border};
  border-radius:10px;
  transition:border-color .2s,box-shadow .2s;
  box-shadow:0 1px 4px rgba(0,0,0,.05);
}
.panel:hover{border-color:${C.borderHi};box-shadow:0 2px 12px rgba(0,0,0,.07)}
.panel-accent{border-left:3px solid ${C.navy}}
.panel-gold{border-left:3px solid ${C.gold}}
.panel-green{border-left:3px solid ${C.green}}
.panel-purple{border-left:3px solid ${C.purple}}
.panel-teal{border-left:3px solid ${C.teal}}

/* Sidebar section */
.sidebar-section{
  background:${C.card};
  border:1px solid ${C.border};
  border-radius:10px;
  overflow:hidden;
  box-shadow:0 1px 4px rgba(0,0,0,.05);
  width:100%;
}
.sidebar-section-hd{
  padding:9px 12px;
  border-bottom:1px solid ${C.border};
  display:flex;align-items:center;gap:8px;
  background:${C.surface};
}
.sidebar-section-bd{padding:10px}

/* Step badge */
.step-badge{
  width:20px;height:20px;
  border-radius:5px;
  display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:700;
  font-family:'DM Mono',monospace;
  flex-shrink:0;
  color:#fff;
}

/* Mode button */
.mode-btn{
  display:flex;align-items:center;justify-content:space-between;
  padding:8px 10px;
  border-radius:8px;
  cursor:pointer;
  transition:all .18s;
  border:1px solid ${C.border};
  background:transparent;
  width:100%;
  font-family:'DM Sans',sans-serif;
  font-size:12px;
  margin-bottom:5px;
  text-align:left;
}
.mode-btn:last-child{margin-bottom:0}
.mode-btn:hover{background:rgba(0,0,0,.03);border-color:${C.borderHi}}

/* CTA */
.cta-btn{
  width:100%;padding:12px;
  border-radius:9px;border:none;
  font-family:'DM Sans',sans-serif;font-weight:700;font-size:14px;
  cursor:pointer;transition:all .2s;
  position:relative;overflow:hidden;
  letter-spacing:.02em;
}
.cta-btn.active{
  background:${C.navy};color:#fff;
  box-shadow:0 4px 20px rgba(27,42,74,0.20);
}
.cta-btn.active:hover{background:${C.navyLt};box-shadow:0 6px 28px rgba(27,42,74,0.28)}
.cta-btn.inactive{background:${C.surface};color:${C.dim};cursor:not-allowed;opacity:.6}
.cta-btn.loading{background:${C.bgAlt};color:${C.muted};cursor:wait;border:1px solid ${C.border}}

/* Progress steps */
.progress-steps{display:flex;flex-direction:column;gap:3px;margin-top:8px}
.progress-step{
  display:flex;align-items:center;gap:7px;
  padding:5px 8px;border-radius:6px;
  font-size:11px;font-family:'DM Mono',monospace;
  transition:all .3s;
}
.progress-step.done{color:${C.greenLt};background:${C.greenDim}}
.progress-step.active{color:${C.text};background:rgba(255,255,255,.04);animation:pulse 1.2s ease infinite}
.progress-step.pending{color:${C.dim}}

/* Score ring */
.score-ring{
  display:flex;align-items:center;justify-content:center;flex-direction:column;
  width:72px;height:72px;border-radius:50%;border:2px solid;
  font-family:'DM Mono',monospace;font-size:20px;font-weight:700;
  flex-shrink:0;position:relative;
  animation:countUp .5s cubic-bezier(.22,1,.36,1) both;
}
.score-ring::after{
  content:'';position:absolute;inset:-4px;border-radius:50%;
  border:1px solid currentColor;opacity:.15;
}

/* Reco badge */
.reco-badge{
  display:inline-flex;align-items:center;gap:5px;
  padding:4px 12px;border-radius:100px;
  font-size:10px;font-weight:700;letter-spacing:.08em;
  text-transform:uppercase;font-family:'DM Mono',monospace;
  border:1px solid;
}

/* Bars */
.bar-row{display:grid;grid-template-columns:128px 1fr 34px;align-items:center;gap:9px;margin-bottom:7px}
.bar-track{height:4px;background:${C.border};border-radius:100px;overflow:hidden}
.bar-fill{height:100%;border-radius:100px;transition:width 1.2s cubic-bezier(.22,1,.36,1)}

/* Tables */
.cmp-table{width:100%;border-collapse:collapse;font-size:12px}
.cmp-table th{
  background:${C.surface};padding:9px 12px;text-align:left;
  font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;
  color:${C.muted};border-bottom:1px solid ${C.border};
  font-family:'DM Mono',monospace;
}
.cmp-table td{padding:10px 12px;border-bottom:1px solid ${C.border};vertical-align:middle;line-height:1.5}
.cmp-table tr:last-child td{border-bottom:none}
.cmp-table tr:hover td{background:rgba(0,0,0,.022)}

/* Spinner */
.spinner{width:26px;height:26px;border:2px solid ${C.border};border-top-color:${C.navy};border-radius:50%;animation:spin .65s linear infinite}

/* Dropzone */
.drop-zone{
  border:2px dashed ${C.border};border-radius:8px;
  padding:14px 10px;text-align:center;cursor:pointer;
  transition:all .2s;background:${C.bgAlt};
  width:100%;box-sizing:border-box;
  min-height:72px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;
}
.drop-zone:hover,.drop-zone.drag{border-color:${C.accent};background:${C.accentDim}}

/* File item */
.file-item{
  display:flex;align-items:center;gap:8px;
  padding:6px 10px;border-radius:7px;
  background:${C.surface};border:1px solid ${C.border};
  font-size:11px;font-family:'DM Mono',monospace;
  animation:fadeIn .25s ease both;
}

/* Tag pill */
.tag{
  display:inline-flex;align-items:center;gap:4px;
  padding:2px 8px;border-radius:100px;font-size:10px;font-weight:600;
  font-family:'DM Mono',monospace;letter-spacing:.04em;border:1px solid;
}

/* Toast */
.toast{
  position:fixed;bottom:22px;right:22px;
  background:${C.cardHi};border-radius:10px;
  padding:11px 16px;display:flex;align-items:center;gap:9px;
  font-size:12px;color:${C.text};z-index:300;
  box-shadow:0 8px 40px rgba(0,0,0,.7);max-width:300px;
  animation:slideIn .3s cubic-bezier(.22,1,.36,1) both;
}

/* Modal */
.modal-overlay{
  position:fixed;inset:0;background:rgba(6,8,16,.88);
  backdrop-filter:blur(12px);z-index:200;
  display:flex;align-items:center;justify-content:center;padding:18px;
}
.modal-box{
  background:${C.card};border:1px solid ${C.border};
  border-radius:14px;padding:28px;max-width:360px;width:100%;
  box-shadow:0 24px 80px rgba(0,0,0,.7);
  animation:fadeUp .3s cubic-bezier(.22,1,.36,1) both;
}

/* Credit card */
.credit-card{
  background:${C.surface};border:1px solid ${C.border};
  border-radius:10px;padding:16px 12px;text-align:center;cursor:pointer;
  transition:all .2s;
}
.credit-card:hover{border-color:${C.gold};background:${C.goldDim}}

/* Results header */
.results-hd{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:20px;flex-wrap:wrap;gap:10px;
}

/* Candidate card */
.candidate-card{
  background:${C.card};border:1px solid ${C.border};
  border-radius:12px;overflow:hidden;
  animation:fadeUp .4s cubic-bezier(.22,1,.36,1) both;
  margin-bottom:12px;
  transition:border-color .2s;
}
.candidate-card:hover{border-color:${C.borderHi}}
.candidate-card-hd{
  display:flex;align-items:center;justify-content:space-between;
  padding:16px 20px;cursor:pointer;gap:12px;
}
.candidate-card-bd{padding:0 20px 20px;border-top:1px solid ${C.border}}

/* Section pill header */
.section-pill{
  display:inline-flex;align-items:center;gap:5px;
  padding:3px 10px;border-radius:100px;
  font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;
  font-family:'DM Mono',monospace;border:1px solid;
  margin-bottom:12px;margin-top:18px;
}

/* Info grid */
.info-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:14px}
.info-cell{background:${C.surface};border:1px solid ${C.border};border-radius:7px;padding:10px 12px}

/* Cumple badge */
.cumple-si{color:${C.greenLt};font-weight:700;font-size:10px;font-family:'DM Mono',monospace}
.cumple-parcial{color:${C.amberLt};font-weight:700;font-size:10px;font-family:'DM Mono',monospace}
.cumple-no{color:${C.redLt};font-weight:700;font-size:10px;font-family:'DM Mono',monospace}

/* Brecha badge */
.brecha-sin{color:${C.greenLt};font-size:10px;font-family:'DM Mono',monospace;font-weight:600}
.brecha-parcial{color:${C.amberLt};font-size:10px;font-family:'DM Mono',monospace;font-weight:600}
.brecha-sig{color:${C.redLt};font-size:10px;font-family:'DM Mono',monospace;font-weight:600}
.brecha-crit{color:${C.redLt};font-size:10px;font-family:'DM Mono',monospace;font-weight:700;text-transform:uppercase}

/* Dict card */
.comp-type-badge{
  display:inline-flex;align-items:center;padding:1px 7px;
  border-radius:4px;font-size:9px;font-weight:700;
  font-family:'DM Mono',monospace;letter-spacing:.07em;
  text-transform:uppercase;
}

/* Profile card fields */
.pf-row{
  display:grid;grid-template-columns:110px 1fr;gap:8px;
  padding:7px 0;border-bottom:1px solid ${C.border};align-items:start;
  font-size:12px;
}
.pf-row:last-child{border-bottom:none}
.pf-label{color:${C.muted};font-family:'DM Mono',monospace;font-size:10px;
  font-weight:600;letter-spacing:.06em;text-transform:uppercase;padding-top:1px}

/* Nav tabs */
.view-tabs{display:flex;gap:4px;margin-bottom:20px;flex-wrap:wrap}
.view-tab{
  padding:7px 14px;border-radius:7px;font-size:12px;font-weight:600;
  cursor:pointer;transition:all .18s;border:1px solid;
  font-family:'DM Sans',sans-serif;background:transparent;
}
`

// ─── RADAR CHART ──────────────────────────────────────────────────────────────
function RadarChart({ competencies, color = C.navy }) {
  const entries = Object.entries(competencies || {})
  if (!entries.length) return null

  // Tamaño interno del polígono — el viewBox agrega margen para labels
  const SIZE   = 260           // área de dibujo
  const MARGIN = 64            // espacio para etiquetas alrededor
  const VB     = SIZE + MARGIN * 2
  const cx = VB / 2
  const cy = VB / 2
  const r  = SIZE * 0.40       // radio del polígono al 100%

  const n     = entries.length
  const angle = i => (Math.PI * 2 * i) / n - Math.PI / 2
  const pt    = (i, pct) => {
    const a = angle(i), d = (pct / 100) * r
    return [cx + d * Math.cos(a), cy + d * Math.sin(a)]
  }

  // Anillos de referencia
  const rings = [25, 50, 75, 100]
  const ringPath = pct =>
    Array.from({ length: n }, (_, i) => pt(i, pct))
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + 'Z'

  // Radios (spokes)
  const spokes = Array.from({ length: n }, (_, i) => {
    const [x, y] = pt(i, 100)
    return `M${cx.toFixed(1)},${cy.toFixed(1)}L${x.toFixed(1)},${y.toFixed(1)}`
  })

  // Polígono de datos
  const dataPts  = entries.map((_, i) => pt(i, entries[i][1]))
  const dataPath = dataPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + 'Z'

  const uid = `radar_${color.replace(/[^a-z0-9]/gi, '')}`

  // Color de relleno semitransparente
  const fillColor = color === C.navy ? 'rgba(27,42,74,0.12)' : 'rgba(201,133,58,0.12)'
  const strokeCol = color

  return (
    <div style={{ width: '100%' }}>
      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        style={{ width: '100%', maxWidth: 340, display: 'block', margin: '0 auto', animation: 'radarIn .5s ease both' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id={uid} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity=".18" />
            <stop offset="100%" stopColor={color} stopOpacity=".02" />
          </radialGradient>
        </defs>

        {/* Anillos */}
        {rings.map((pct, i) => (
          <path key={i} d={ringPath(pct)} fill="none"
            stroke={C.border} strokeWidth={pct === 100 ? 1.5 : 1}
            strokeDasharray={pct === 100 ? 'none' : '3,3'}
          />
        ))}

        {/* Labels de anillos (25, 50, 75) */}
        {[25, 50, 75].map(pct => {
          const [x, y] = pt(0, pct)
          return (
            <text key={pct} x={x + 3} y={y - 3}
              fontSize="8" fontFamily="'DM Mono',monospace"
              fill={C.dim} textAnchor="start">{pct}</text>
          )
        })}

        {/* Spokes */}
        {spokes.map((d, i) => (
          <path key={i} d={d} stroke={C.borderHi} strokeWidth="1" />
        ))}

        {/* Polígono de datos */}
        <path d={dataPath} fill={`url(#${uid})`} stroke={strokeCol} strokeWidth="2" strokeLinejoin="round" />

        {/* Puntos */}
        {dataPts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="4" fill={color} stroke={C.surface} strokeWidth="2" />
        ))}

        {/* Etiquetas con fondo blanco para legibilidad */}
        {entries.map(([name, val], i) => {
          const a      = angle(i)
          const labelR = r + 34
          const lx     = cx + labelR * Math.cos(a)
          const ly     = cy + labelR * Math.sin(a)
          const anchor = Math.cos(a) < -0.1 ? 'end' : Math.cos(a) > 0.1 ? 'start' : 'middle'
          // Línea corta desde el borde del polígono hasta la etiqueta
          const [ex, ey] = pt(i, 100)
          const shortR   = r + 10
          const sx       = cx + shortR * Math.cos(a)
          const sy       = cy + shortR * Math.sin(a)
          const col      = scoreColor(val)
          const shortName = name.length > 18 ? name.slice(0, 17) + '…' : name

          return (
            <g key={i}>
              <line x1={ex.toFixed(1)} y1={ey.toFixed(1)} x2={lx.toFixed(1)} y2={ly.toFixed(1)}
                stroke={C.borderHi} strokeWidth="1" strokeDasharray="2,2" />
              {/* Fondo para el texto */}
              <rect
                x={anchor === 'end' ? lx - 90 : anchor === 'start' ? lx : lx - 45}
                y={ly - 14}
                width={90} height={28}
                rx={4} fill={C.surface} opacity=".88"
              />
              <text x={lx} y={ly - 2} textAnchor={anchor}
                fontSize="9" fontFamily="'DM Mono',monospace"
                fill={C.muted} fontWeight="500">{shortName}</text>
              <text x={lx} y={ly + 11} textAnchor={anchor}
                fontSize="11" fontFamily="'DM Mono',monospace"
                fill={col} fontWeight="700">{val}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── SUBCOMPONENTS ────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const col = scoreColor(score)
  return (
    <div className="score-ring" style={{ borderColor: col, color: col, boxShadow: `0 0 20px ${col}18` }}>
      <span>{score}</span>
      <span style={{ fontSize: 8, letterSpacing: '.08em', opacity: .55, fontWeight: 500 }}>/100</span>
    </div>
  )
}

function RecoBadge({ reco }) {
  const cfg = RECO_CFG[reco] || RECO_CFG['RESERVA']
  return (
    <span className="reco-badge" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
      {cfg.icon} {cfg.label}
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
    <div
      className={`drop-zone${over ? ' drag' : ''}`}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files) }}
      style={{ position: 'relative' }}
    >
      <input ref={inputRef} type="file" accept=".txt,.pdf,.docx" multiple={multiple}
        onChange={e => onFiles(e.target.files)}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
      <div style={{ fontSize: 18, marginBottom: 3, opacity: .5 }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.navy }}>{label}</div>
      <div style={{ fontSize: 9, color: C.dim, marginTop: 2, fontFamily: "'DM Mono'" }}>{hint}</div>
    </div>
  )
}

function FileItem({ name, status, onRemove }) {
  const cols = { ready: C.greenLt, ocr: C.amberLt, error: C.redLt, loading: C.muted }
  const icons = { ready: '✓', ocr: '◌', error: '✗', loading: '…' }
  return (
    <div className="file-item">
      <span style={{ color: cols[status] || C.muted, fontSize: 11, flexShrink: 0 }}>{icons[status] || '…'}</span>
      <span style={{ flex: 1, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 11 }}>{name}</span>
      {status === 'loading' && <div className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5, flexShrink: 0 }} />}
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
    <div className="panel fade-up" style={{ padding: '18px 22px', borderLeft: `3px solid ${C.accent}`, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className="spinner" />
      <div>
        <div style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 13, color: C.accent }}>Extrayendo estructura del perfil…</div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>La IA está leyendo el documento y organizando los requisitos del cargo</div>
      </div>
    </div>
  )

  if (!profile) return null

  return (
    <div className="panel fade-up" style={{ borderLeft: `3px solid ${C.accent}`, marginBottom: 4 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: collapsed ? 'none' : `1px solid ${C.border}`, cursor: 'pointer' }} onClick={() => setCollapsed(c => !c)}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(79,125,243,0.08)', border: `1px solid rgba(79,125,243,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>📋</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, color: C.accent, fontFamily: "'DM Mono'", letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2 }}>
            Cuadro Resumen del Cargo · Referencia de Contraste
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, lineHeight: 1.1, color: C.text }}>
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


// ─── COMPETENCY DICT CARD ─────────────────────────────────────────────────────
const NIVEL_CFG = {
  'BASICO':     { color: '#7A9BB8', bg: 'rgba(122,155,184,0.10)', dot: '○' },
  'INTERMEDIO': { color: '#EAB308', bg: 'rgba(234,179,8,0.10)',   dot: '◑' },
  'ALTO':       { color: '#0EA5E9', bg: 'rgba(14,165,233,0.10)',  dot: '●' },
  'CRITICO':    { color: '#F43F5E', bg: 'rgba(244,63,94,0.10)',   dot: '★' },
}
const TIPO_CFG = {
  'CONDUCTUAL': { color: '#A855F7', bg: 'rgba(168,85,247,0.10)' },
  'TECNICA':    { color: '#0EA5E9', bg: 'rgba(14,165,233,0.10)' },
  'LIDERAZGO':  { color: '#EAB308', bg: 'rgba(234,179,8,0.10)'  },
  'GESTION':    { color: '#10B981', bg: 'rgba(16,185,129,0.10)' },
}
const BRECHA_CFG = {
  'SIN BRECHA':   { color: '#10B981', icon: '✅' },
  'PARCIAL':      { color: '#F59E0B', icon: '🟡' },
  'SIGNIFICATIVA':{ color: '#F43F5E', icon: '⚠️' },
  'CRITICA':      { color: '#F43F5E', icon: '🔴' },
}

function CompetencyDictCard({ dict, loading }) {
  const [collapsed, setCollapsed] = useState(false)
  const [expanded, setExpanded]   = useState(null)

  if (loading) return (
    <div className="panel fade-up" style={{ padding: '18px 22px', borderLeft: `3px solid ${C.gold}`, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className="spinner" />
      <div>
        <div style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 13, color: C.gold }}>Extrayendo diccionario de competencias…</div>
        <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>Identificando competencias técnicas y conductuales del cargo</div>
      </div>
    </div>
  )
  if (!dict) return null

  const comps = dict.competencias || []
  const byTipo = comps.reduce((acc, c) => {
    acc[c.tipo] = acc[c.tipo] || []
    acc[c.tipo].push(c)
    return acc
  }, {})

  return (
    <div className="panel fade-up" style={{ borderLeft: `3px solid ${C.gold}` }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: collapsed ? 'none' : `1px solid ${C.border}`, cursor: 'pointer' }}
        onClick={() => setCollapsed(c => !c)}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: C.goldDim, border: `1px solid ${C.gold}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🧠</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, color: C.gold, fontFamily: "'DM Mono'", letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2 }}>
            Diccionario de Competencias · Referencia de Contraste
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 17, lineHeight: 1.1, color: C.text }}>
            {dict.nombreCargo || 'Cargo'} — {comps.length} competencias identificadas
          </div>
        </div>
        {/* Resumen por tipo */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
          {Object.entries(byTipo).map(([tipo, list]) => {
            const cfg = TIPO_CFG[tipo] || TIPO_CFG['TECNICA']
            return (
              <span key={tipo} style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono'", color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: 100, padding: '3px 9px' }}>
                {tipo} ×{list.length}
              </span>
            )
          })}
        </div>
        <span style={{ color: C.dim, fontSize: 14, marginLeft: 8 }}>{collapsed ? '▸' : '▾'}</span>
      </div>

      {!collapsed && (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(310px,1fr))', gap: 10 }}>
            {comps.map((comp, i) => {
              const nivelCfg = NIVEL_CFG[comp.nivelRequerido] || NIVEL_CFG['INTERMEDIO']
              const tipoCfg  = TIPO_CFG[comp.tipo] || TIPO_CFG['TECNICA']
              const isOpen = expanded === i
              return (
                <div key={i}
                  onClick={() => setExpanded(isOpen ? null : i)}
                  style={{ background: C.surface, border: `1px solid ${isOpen ? C.gold + '50' : C.border}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all .2s' }}>
                  {/* Comp header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: isOpen ? 10 : 0 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono'", color: tipoCfg.color, background: tipoCfg.bg, border: `1px solid ${tipoCfg.color}25`, borderRadius: 100, padding: '2px 7px' }}>{comp.tipo}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono'", color: nivelCfg.color, background: nivelCfg.bg, border: `1px solid ${nivelCfg.color}25`, borderRadius: 100, padding: '2px 7px' }}>{nivelCfg.dot} {comp.nivelRequerido}</span>
                        {comp.fuente === 'INFERIDA' && (
                          <span style={{ fontSize: 9, color: C.dim, fontFamily: "'DM Mono'", border: `1px solid ${C.border}`, borderRadius: 100, padding: '2px 6px' }}>INFERIDA</span>
                        )}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.text, lineHeight: 1.3 }}>{comp.nombre}</div>
                    </div>
                    <span style={{ color: C.dim, fontSize: 12, flexShrink: 0, marginTop: 2 }}>{isOpen ? '▾' : '▸'}</span>
                  </div>
                  {isOpen && (
                    <div>
                      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.65, marginBottom: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                        {comp.definicion}
                      </div>
                      {comp.indicadores?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 9, color: C.dim, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.09em', marginBottom: 6 }}>Indicadores Conductuales</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {comp.indicadores.map((ind, j) => (
                              <div key={j} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                                <span style={{ color: C.gold, fontSize: 10, marginTop: 2, flexShrink: 0 }}>◈</span>
                                <span style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>{ind}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
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
    <div className="panel slide-in" style={{ padding: '20px 22px', borderLeft, animationDelay: `${idx * 0.06}s` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
        <ScoreRing score={c.score} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {idx < 3 && (
            <div style={{ fontSize: 9, fontWeight: 700, color: rankColors[idx], letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: "'DM Mono'", marginBottom: 3 }}>
              {rankLabels[idx]}
            </div>
          )}
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 17, lineHeight: 1.2, marginBottom: 5 }}>{c.name || 'Candidato'}</div>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* Resumen ejecutivo */}
          {(c.executiveSummary || c.summary) && (
            <div style={{ fontSize: 13, lineHeight: 1.7, color: C.muted, background: C.bgAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
              {c.executiveSummary || c.summary}
            </div>
          )}

          {/* Fortalezas + Brechas + Riesgos en fila */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 10, marginBottom: 14 }}>
            {c.strengths?.length > 0 && (
              <div>
                <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, marginBottom: 6 }}>Fortalezas</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {c.strengths.map((s, i) => <span key={i} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 100, background: C.greenDim, border: `1px solid ${C.green}28`, color: C.greenLt, fontWeight: 500 }}>{s}</span>)}
                </div>
              </div>
            )}
            {c.gaps?.length > 0 && (
              <div>
                <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, marginBottom: 6 }}>Brechas</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {c.gaps.map((g, i) => <span key={i} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 100, background: C.redDim, border: `1px solid ${C.red}28`, color: C.redLt, fontWeight: 500 }}>{g}</span>)}
                </div>
              </div>
            )}
            {c.riskFactors?.length > 0 && (
              <div>
                <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, marginBottom: 6 }}>Factores de Riesgo</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {c.riskFactors.map((r, i) => <span key={i} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 100, background: C.amberDim, border: `1px solid ${C.amber}28`, color: C.amberLt, fontWeight: 500 }}>⚠ {r}</span>)}
                </div>
              </div>
            )}
          </div>

          {/* Desglose curricular */}
          {c.scoreBreakdown && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 700, marginBottom: 8 }}>Desglose Curricular</div>
              {Object.entries(c.scoreBreakdown).map(([k, v]) => <BarRow key={k} label={k} value={v} />)}
            </div>
          )}

          {/* ── RADAR COMPETENCIAL — centrado, ancho completo ── */}
          {c.competencies && Object.keys(c.competencies).length > 0 && (
            <div style={{
              background: C.bgAlt,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '18px 24px 14px',
              marginBottom: 16,
            }}>
              <div style={{
                fontSize: 9, color: C.dim, textTransform: 'uppercase',
                letterSpacing: '.12em', fontWeight: 700,
                marginBottom: 4, textAlign: 'center',
              }}>
                Radar Competencial
              </div>
              <RadarChart competencies={c.competencies} color={C.navy} />
            </div>
          )}

          {/* Tabla de contraste perfil vs candidato */}
          {c.matchDetail && <MatchDetailTable matchDetail={c.matchDetail} />}

          {/* Contraste competencias vs. diccionario */}
          {c.competencyContrast?.length > 0 && <CompetencyContrastTable competencyContrast={c.competencyContrast} />}

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
        <div className="panel" style={{ overflow: 'auto' }}>
          <table className="cmp-table">
            <thead>
              <tr>
                <th style={{ minWidth: 160 }}>Candidato</th>
                <th style={{ textAlign: 'center' }}>📋 Perfil</th>
                <th style={{ textAlign: 'center' }}>🧠 Competencias</th>
                <th style={{ textAlign: 'center' }}>🔬 360°</th>
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
                      <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14 }}>{row.name}</div>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
          {matrix.map((row, i) => {
            const comps = row.f?.competencies || row.co?.competencies
            if (!comps) return (
              <div key={i} className="panel" style={{ padding: 18, textAlign: 'center' }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, marginBottom: 8 }}>{row.name}</div>
                <div style={{ fontSize: 12, color: C.dim }}>Sin datos de competencias</div>
              </div>
            )
            const radarColor = i % 2 === 0 ? C.navy : C.accent
            const reco = row.f?.recommendation || row.co?.recommendation || row.p?.recommendation
            return (
              <div key={i} className="panel" style={{ padding: '18px' }}>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{row.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  {reco && <RecoBadge reco={reco} />}
                  <span style={{ fontFamily: "'DM Mono'", color: scoreColor(row.avg), fontWeight: 700, fontSize: 13 }}>AVG {row.avg}</span>
                </div>
                <RadarChart competencies={comps} color={radarColor} />
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
              <div key={i} className="panel" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16, borderLeft: `3px solid ${rankColor}` }}>
                <div style={{ fontFamily: "'DM Mono'", fontWeight: 700, fontSize: 22, color: C.dim, minWidth: 32 }}>#{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 16, marginBottom: 3 }}>{row.name}</div>
                  {summary && <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{summary}</div>}
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    { label: 'Perfil', score: row.p?.score, color: C.accent },
                    { label: 'Compet.', score: row.co?.score, color: C.gold },
                    { label: '360°', score: row.f?.score, color: C.green },
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
  const [credits, setCredits]                   = useState(20)
  const [jobFile, setJobFile]                   = useState(null)
  const [profileData, setProfileData]           = useState(null)
  const [profileLoading, setProfileLoading]     = useState(false)
  const [competencyDict, setCompetencyDict]     = useState(null)
  const [competencyLoading, setCompetencyLoading] = useState(false)
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
      await extractCompetencyDict(extracted, file.name)
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

  async function extractCompetencyDict(content, fileName) {
    setCompetencyLoading(true)
    try {
      const parsed = await callExtractAPI(
        PROMPT_EXTRACT_COMPETENCIES,
        `DOCUMENTO DE PERFIL DE CARGO (${fileName}):

${content.slice(0, 4000)}`
      )
      setCompetencyDict(parsed)
      notify('✓', `Diccionario de competencias listo — ${parsed.competencias?.length || 0} competencias identificadas`)
    } catch (e) {
      notify('⚠', `Diccionario de competencias: ${e.message}`, 'w')
    } finally {
      setCompetencyLoading(false)
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

    if (modeId === 'profile' && profileData) {
      // Fase 2 Perfil: cuadro estructurado como referencia curricular
      userPrompt += `CUADRO RESUMEN ESTRUCTURADO DEL CARGO (referencia de contraste):\n${JSON.stringify(profileData, null, 2)}\n\n`
      userPrompt += `PERFIL COMPLETO ORIGINAL (${jobFile.name}):\n${jobFile.content.slice(0, 2000)}\n\nMODO: ${modeLabel}\n\n`
    } else if (modeId === 'competencies' && competencyDict) {
      // Fase 2 Competencias: diccionario como referencia competencial
      userPrompt += `DICCIONARIO DE COMPETENCIAS DEL CARGO (referencia de contraste):\n${JSON.stringify(competencyDict, null, 2)}\n\n`
      userPrompt += `PERFIL COMPLETO ORIGINAL (${jobFile.name}):\n${jobFile.content.slice(0, 2000)}\n\nMODO: ${modeLabel}\n\n`
    } else if (modeId === 'full') {
      // Fase 2 360°: AMBOS marcos de referencia integrados
      if (profileData) {
        userPrompt += `BLOQUE 1 — CUADRO RESUMEN ESTRUCTURADO DEL CARGO (referencia curricular):\n${JSON.stringify(profileData, null, 2)}\n\n`
      }
      if (competencyDict) {
        userPrompt += `BLOQUE 2 — DICCIONARIO DE COMPETENCIAS DEL CARGO (referencia competencial):\n${JSON.stringify(competencyDict, null, 2)}\n\n`
      }
      userPrompt += `PERFIL COMPLETO ORIGINAL (${jobFile.name}):\n${jobFile.content.slice(0, 2000)}\n\nMODO: ${modeLabel}\n\n`
    } else {
      userPrompt += `PERFIL DEL PUESTO (${jobFile.name}):\n${jobFile.content.slice(0, 2000)}\n\nMODO: ${modeLabel}\n\n`
    }

    cvList.forEach((cv, i) => { userPrompt += `--- CV ${i + 1}: ${cv.name} ---\n${cv.content.slice(0, 1800)}\n\n` })

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
        setLoadMsg('Ejecutando análisis 360° (3/3)…')
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
    const rows = [['Candidato', 'Score Perfil', 'Score Competencias', 'Score 360°', 'Promedio', 'Recomendación', 'Resumen']]
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
  const activeMode = MODES.find(m => m.id === mode)

  const LOAD_STEPS = {
    profile:      ['Procesando documentos', 'Contrastando perfil', 'Generando evaluación'],
    competencies: ['Procesando documentos', 'Aplicando diccionario', 'Levantando evidencias'],
    full:         ['Procesando documentos', 'Análisis curricular', 'Análisis competencial', 'Integrando 360°'],
    compare:      ['Análisis de Perfil', 'Análisis Competencias', 'Análisis 360°'],
  }
  const steps = LOAD_STEPS[mode] || LOAD_STEPS.profile
  const currentStep = loadMsg
    ? steps.findIndex(s => loadMsg.toLowerCase().includes(s.split(' ')[0].toLowerCase()))
    : 0
  const stepIdx = currentStep === -1 ? 0 : currentStep

  return (
    <>
      <style>{CSS}</style>
      <div className="bg-grid" />
      <div className="bg-glow" />

      {/* HEADER */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 57,
        background: `rgba(245,246,248,0.96)`, backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'DM Mono'", fontWeight: 700, fontSize: 12, color: '#fff',
            boxShadow: `0 0 14px ${C.navyDim}`,
          }}>G</div>
          <div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 14, letterSpacing: '-.01em' }}>
              <span style={{ color: C.accent }}>#</span>Match<span style={{ color: C.navy, fontWeight: 600, opacity:.6 }}>Via</span><span style={{ color: C.navy }}>Geperex</span>
            </div>
            <div style={{ fontFamily: "'DM Mono'", fontSize: 8.5, color: C.dim, letterSpacing: '.09em', marginTop: 1 }}>
              GEPEREX LIMITADA · RUT 78.110.793-K
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontFamily: "'DM Mono'", fontSize: 11, color: C.accent,
            background: C.accentDim, border: `1px solid ${C.accent}25`,
            borderRadius: 100, padding: '4px 12px', fontWeight: 600,
          }}>⬡ {credits} cr</span>
          <button onClick={() => setModal(true)} style={{
            padding: '4px 12px', borderRadius: 100,
            border: `1px solid ${C.border}`, background: 'transparent',
            color: C.muted, fontSize: 11, cursor: 'pointer',
            fontFamily: "'DM Sans'", fontWeight: 600, transition: 'all .15s',
          }}>+ Recargar</button>
        </div>
      </header>

      {/* APP SHELL */}
      <div className="app-shell">

        {/* ── SIDEBAR ─────────────────────────────────────── */}
        <aside className="sidebar">

          {/* Step 1 — Perfil */}
          <div className="sidebar-section">
            <div className="sidebar-section-hd">
              <div className="step-badge" style={{ background: C.navy }}>1</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Perfil del Puesto</span>
              {jobFile?.status === 'ready' && (
                <span className="tag" style={{ marginLeft: 'auto', color: C.greenLt, borderColor: `${C.green}35`, background: C.greenDim, fontSize: 9 }}>✓ LISTO</span>
              )}
            </div>
            <div className="sidebar-section-bd">
              {!jobFile ? (
                <DropZone icon="📄" label="Subir Perfil de Cargo" hint=".pdf · .docx · .txt" multiple={false} onFiles={handleJobFiles} inputRef={jobRef} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <FileItem name={jobFile.name} status={jobFile.status} onRemove={() => { setJobFile(null); setProfileData(null); setCompetencyDict(null); if (jobRef.current) jobRef.current.value = '' }} />
                  {jobFile.status === 'loading' && loadMsg && (
                    <div style={{ fontSize: 10, color: C.amberLt, fontFamily: "'DM Mono'", paddingLeft: 2 }}>↳ {loadMsg}</div>
                  )}
                  {(profileLoading || competencyLoading) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div className="spinner" style={{ width: 10, height: 10, borderWidth: 1.5, flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: C.muted, fontFamily: "'DM Mono'" }}>
                        {profileLoading ? 'Extrayendo estructura…' : 'Construyendo diccionario…'}
                      </span>
                    </div>
                  )}
                  {profileData && !profileLoading && (
                    <div style={{ fontSize: 10, color: C.greenLt, fontFamily: "'DM Mono'" }}>✓ Estructura extraída</div>
                  )}
                  {competencyDict && !competencyLoading && (
                    <div style={{ fontSize: 10, color: C.navy, fontFamily: "'DM Mono'" }}>✓ {competencyDict.competencias?.length ?? '?'} competencias</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Step 2 — CVs */}
          <div className="sidebar-section">
            <div className="sidebar-section-hd">
              <div className="step-badge" style={{ background: C.accent }}>2</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>CVs Candidatos</span>
              {cvFiles.length > 0 && (
                <span className="tag" style={{ marginLeft: 'auto', color: C.accent, borderColor: `${C.accent}35`, background: C.accentDim, fontSize: 9 }}>{cvFiles.length} CV{cvFiles.length > 1 ? 's' : ''}</span>
              )}
            </div>
            <div className="sidebar-section-bd">
              <DropZone icon="👥" label="Subir CVs" hint=".pdf · .docx · .txt · Múltiples" multiple={true} onFiles={handleCvFiles} inputRef={cvRef} />
              {cvFiles.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 130, overflowY: 'auto' }}>
                  {cvFiles.map((cv, i) => (
                    <FileItem key={i} name={cv.name} status={cv.status} onRemove={() => setCvFiles(p => p.filter((_, j) => j !== i))} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Step 3 — Modo */}
          <div className="sidebar-section">
            <div className="sidebar-section-hd">
              <div className="step-badge" style={{ background: activeMode?.color ?? C.navy }}>3</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Tipo de Análisis</span>
            </div>
            <div className="sidebar-section-bd" style={{ padding: '8px 10px' }}>
              {MODES.map(m => (
                <button key={m.id} className="mode-btn"
                  onClick={() => setMode(m.id)}
                  style={{
                    background: mode === m.id ? `${m.color}10` : 'transparent',
                    borderColor: mode === m.id ? `${m.color}45` : C.border,
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 13, flexShrink: 0 }}>{m.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: mode === m.id ? m.color : C.text, fontWeight: 600, fontSize: 11 }}>{m.label}</div>
                      <div style={{ fontSize: 9, color: C.dim, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.desc}</div>
                    </div>
                  </div>
                  <span className="tag" style={{ color: C.accent, borderColor: `${C.accent}30`, background: C.accentDim, marginLeft: 6, flexShrink: 0, fontSize: 9 }}>
                    {m.cost}cr
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {canAnalyze && !loading && (
              <div style={{ fontSize: 10, color: C.dim, textAlign: 'center', fontFamily: "'DM Mono'" }}>
                Costo: <span style={{ color: C.accent, fontWeight: 600 }}>{totalCost} créditos</span>
              </div>
            )}
            <button
              className={`cta-btn ${loading ? 'loading' : canAnalyze ? 'active' : 'inactive'}`}
              onClick={analyze} disabled={!canAnalyze || loading}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  Analizando…
                </span>
              ) : '◈ Iniciar Análisis'}
            </button>
            <button onClick={reset} style={{
              width: '100%', padding: '7px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: 'transparent',
              color: C.muted, cursor: 'pointer',
              fontFamily: "'DM Sans'", fontSize: 11, fontWeight: 500, transition: 'all .15s',
            }}>↺ Nuevo proceso</button>
            {error && (
              <div style={{
                background: C.redDim, border: `1px solid ${C.red}30`,
                borderRadius: 8, padding: '8px 10px',
                fontSize: 11, color: C.redLt, lineHeight: 1.5,
              }}>⚠ {error}</div>
            )}
          </div>

        </aside>

        {/* ── CONTENT ─────────────────────────────────────── */}
        <main className="content">

          {/* Loading */}
          {loading && (
            <div className="panel fade-in" style={{ padding: '36px 28px', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 20px' }} />
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 17, marginBottom: 4 }}>
                Procesando análisis
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>
                {loadMsg || 'Iniciando…'}
              </div>
              <div className="progress-steps">
                {steps.map((s, i) => (
                  <div key={i} className={`progress-step ${i < stepIdx ? 'done' : i === stepIdx ? 'active' : 'pending'}`}>
                    <span style={{ flexShrink: 0 }}>{i < stepIdx ? '✓' : i === stepIdx ? '›' : '○'}</span>
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Profile + Competency cards */}
          {!loading && (profileData || profileLoading) && (
            <div style={{ marginBottom: 12 }}>
              <ProfileCard profile={profileData} loading={profileLoading} />
            </div>
          )}
          {!loading && (competencyDict || competencyLoading) && (
            <div style={{ marginBottom: 20 }}>
              <CompetencyDictCard dict={competencyDict} loading={competencyLoading} />
            </div>
          )}

          {/* View tabs */}
          {!loading && (results || compareResults) && (
            <div className="view-tabs">
              {results && (
                <button className="view-tab"
                  onClick={() => setActiveView('results')}
                  style={{
                    color: activeView === 'results' ? C.navy : C.muted,
                    borderColor: activeView === 'results' ? `${C.navy}50` : C.border,
                    background: activeView === 'results' ? C.navyDim : 'transparent',
                  }}>
                  ◈ Resultados <span style={{ fontFamily: "'DM Mono'", fontSize: 10, opacity: .7 }}>({results.candidates.length})</span>
                </button>
              )}
              {compareResults && (
                <button className="view-tab"
                  onClick={() => setActiveView('compare')}
                  style={{
                    color: activeView === 'compare' ? C.accent : C.muted,
                    borderColor: activeView === 'compare' ? `${C.accent}50` : C.border,
                    background: activeView === 'compare' ? C.accentDim : 'transparent',
                  }}>
                  ⚡ Vista Comparativa
                </button>
              )}
            </div>
          )}

          {/* Results */}
          {!loading && activeView === 'results' && results && (
            <div className="fade-up">
              <div className="results-hd">
                <div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18 }}>
                    {MODES.find(m => m.id === results.mode)?.label}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontFamily: "'DM Mono'" }}>
                    {results.candidates.length} candidato{results.candidates.length !== 1 ? 's' : ''} evaluado{results.candidates.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
              {results.candidates.map((c, i) => <CandidateCard key={i} candidate={c} idx={i} />)}
            </div>
          )}

          {/* Comparative */}
          {!loading && activeView === 'compare' && compareResults && (
            <div className="fade-up">
              <div className="results-hd">
                <div>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18 }}>Vista Comparativa Cross-Modal</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontFamily: "'DM Mono'" }}>
                    3 análisis especializados · Radar charts · Exportación CSV
                  </div>
                </div>
              </div>
              <ComparativePanel compareResults={compareResults} onExportCSV={exportCSV} />
            </div>
          )}

          {/* Empty — sin datos aún */}
          {!loading && !results && !compareResults && !profileData && !competencyDict && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', minHeight: '60vh',
              textAlign: 'center', padding: '0 24px',
            }}>
              <div style={{
                width: 80, height: 80, border: `1px solid ${C.border}`,
                borderRadius: 16, display: 'flex', alignItems: 'center',
                justifyContent: 'center', marginBottom: 20,
                background: C.surface, position: 'relative',
              }}>
                <span style={{ fontSize: 32, opacity: .2 }}>◈</span>
                <div style={{
                  position: 'absolute', inset: -1, borderRadius: 16,
                  background: `radial-gradient(circle at 50% 0%, ${C.navyDim} 0%, transparent 60%)`,
                  pointerEvents: 'none',
                }} />
              </div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 20, marginBottom: 8, letterSpacing: '-.02em' }}>
                Listo para analizar
              </div>
              <div style={{ color: C.muted, fontSize: 13, maxWidth: 320, lineHeight: 1.7, marginBottom: 24 }}>
                Sube el perfil del puesto y los CVs desde el panel izquierdo, luego selecciona el tipo de análisis.
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {[
                  { icon: '📋', label: 'Perfil Curricular', color: C.accent },
                  { icon: '🧠', label: 'Competencias', color: C.gold },
                  { icon: '🔬', label: 'Análisis 360°', color: C.green },
                  { icon: '⚡', label: 'Comparativa', color: C.purpleLt },
                ].map(({ icon, label, color }) => (
                  <div key={label} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 12px', borderRadius: 100,
                    border: `1px solid ${color}25`, background: `${color}08`,
                    fontSize: 11, color, fontWeight: 600, fontFamily: "'DM Mono'",
                  }}>
                    {icon} {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty — perfil cargado, esperando CVs */}
          {!loading && !results && !compareResults && (profileData || competencyDict) && cvFiles.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '40px 24px',
              border: `1px dashed ${C.border}`, borderRadius: 12, background: C.surface,
            }}>
              <div style={{ fontSize: 11, color: C.greenLt, fontFamily: "'DM Mono'", marginBottom: 6 }}>
                ✓ Perfil procesado y estructurado
              </div>
              <div style={{ fontSize: 13, color: C.dim }}>
                Sube los CVs de candidatos para continuar
              </div>
            </div>
          )}

        </main>
      </div>

      {/* FOOTER */}
      <footer style={{
        position: 'relative', zIndex: 5, textAlign: 'center',
        padding: '14px 24px', borderTop: `1px solid ${C.border}`,
        fontSize: 10, color: C.dim, fontFamily: "'DM Mono'", letterSpacing: '.05em',
      }}>
        © {new Date().getFullYear()} GEPEREX LIMITADA · RUT 78.110.793-K · #MatchViaGeperex · Powered by Claude AI
      </footer>

      {/* MODAL */}
      {modal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="modal-box">
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 6 }}>Recargar Créditos</div>
            <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 18 }}>
              Selecciona el paquete para tu proceso de selección.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
              {[[50,'$4.990'],[150,'$12.990'],[500,'$34.990']].map(([amt, price]) => (
                <div key={amt} className="credit-card"
                  onClick={() => { setCredits(c => c + amt); setModal(false); notify('⬡', `+${amt} créditos añadidos`) }}>
                  <div style={{ fontFamily: "'DM Mono'", fontWeight: 700, fontSize: 22, color: C.goldLt }}>{amt}</div>
                  <div style={{ fontSize: 9, color: C.dim, marginTop: 1, fontFamily: "'DM Mono'" }}>créditos</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 6, fontWeight: 500 }}>{price}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setModal(false)} style={{
              width: '100%', padding: '8px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: 'transparent',
              color: C.muted, cursor: 'pointer', fontFamily: "'DM Sans'", fontWeight: 600, fontSize: 12,
            }}>Cerrar</button>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className="toast" style={{ borderColor: toast.type === 's' ? `${C.green}40` : `${C.red}40` }}>
          <span>{toast.icon}</span><span style={{ fontSize: 12 }}>{toast.msg}</span>
        </div>
      )}
    </>
  )
}

// ─── STEP HEADER ─────────────────────────────────────────────────────────────
function StepHeader({ n, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <div className="step-badge" style={{ background: C.accent }}>{n}</div>
      <div style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 13 }}>{label}</div>
    </div>
  )
}
