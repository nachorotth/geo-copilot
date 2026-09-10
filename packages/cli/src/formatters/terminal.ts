import type { ScoringOutput } from '@geo-copilot/scorer'

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const BLUE = '\x1b[34m'
const WHITE = '\x1b[37m'
const BG_GREEN = '\x1b[42m\x1b[30m'
const BG_YELLOW = '\x1b[43m\x1b[30m'
const BG_RED = '\x1b[41m\x1b[37m'
const BG_BLUE = '\x1b[44m\x1b[37m'

export function formatTerminalScorecard(url: string, output: ScoringOutput): string {
  const lines: string[] = []

  // Header Box
  lines.push('')
  lines.push(`${CYAN}╔═══════════════════════════════════════════════════════════════════════╗${RESET}`)
  lines.push(`${CYAN}║${RESET}  ${BOLD}${WHITE}🌐 GEO-Copilot Audit Report${RESET}                                         ${CYAN}║${RESET}`)
  lines.push(`${CYAN}║${RESET}  ${DIM}Target URL:${RESET} ${WHITE}${truncate(url, 54)}${RESET}${' '.repeat(Math.max(0, 54 - url.length))}${CYAN}║${RESET}`)
  lines.push(`${CYAN}╠═══════════════════════════════════════════════════════════════════════╣${RESET}`)

  // Total Score & Grade
  const gradeColor = getGradeColor(output.grade)
  const gradeBadge = `${getGradeBg(output.grade)} ${output.grade} ${RESET}`
  const totalScoreBar = renderBar(output.total, 100, 24)

  lines.push(`${CYAN}║${RESET}                                                                       ${CYAN}║${RESET}`)
  lines.push(`${CYAN}║${RESET}   ${BOLD}TOTAL GEO SCORE:${RESET}  ${gradeColor}${BOLD}${String(output.total).padStart(3)}/100${RESET}  ${totalScoreBar}  ${gradeBadge}      ${CYAN}║${RESET}`)
  lines.push(`${CYAN}║${RESET}                                                                       ${CYAN}║${RESET}`)
  lines.push(`${CYAN}╠═══════════════════════════════════════════════════════════════════════╣${RESET}`)
  lines.push(`${CYAN}║${RESET}  ${BOLD}5-PILLAR BREAKDOWN (Academic GEO Rubric)${RESET}                             ${CYAN}║${RESET}`)
  lines.push(`${CYAN}╠═══════════════════════════════════════════════════════════════════════╣${RESET}`)

  const pillarNames: Record<string, string> = {
    crawler_layer: '1. Crawler Layer (SSR & AI Bots)  ',
    knowledge_graph: '2. Knowledge Graph (JSON-LD)      ',
    information_gain: '3. Information Gain (ΔI Density)  ',
    bluf_architecture: '4. BLUF Answer Architecture       ',
    somv: '5. Share of Model Voice (SoMV)    ',
  }

  for (const [key, pillar] of Object.entries(output.pillars)) {
    const p = pillar as { score: number; grade: string; summary: string }
    const label = pillarNames[key] ?? key.padEnd(34)
    const pScoreStr = `${String(p.score).padStart(2)}/20`
    const pBar = renderBar(p.score, 20, 16)
    const pGrade = `${getGradeColor(p.grade)}${p.grade}${RESET}`
    lines.push(`${CYAN}║${RESET}   ${label} ${BOLD}${pScoreStr}${RESET} ${pBar} ${pGrade}  ${CYAN}║${RESET}`)
  }

  lines.push(`${CYAN}╚═══════════════════════════════════════════════════════════════════════╝${RESET}`)
  lines.push('')

  // Diagnostic Findings
  if (output.findings && output.findings.length > 0) {
    lines.push(`${BOLD}${WHITE}🔍 Key Diagnostic Findings & Recommendations:${RESET}`)
    lines.push('')

    const sortedFindings = [...output.findings].sort((a, b) => {
      const order = ['critical', 'high', 'medium', 'low', 'info']
      return order.indexOf(a.severity) - order.indexOf(b.severity)
    })

    for (const f of sortedFindings.slice(0, 8)) {
      const sevBadge = getSeverityBadge(f.severity)
      lines.push(`  ${sevBadge} ${BOLD}${f.title}${RESET}`)
      lines.push(`     ${DIM}${f.description}${RESET}`)
      lines.push(`     ${GREEN}→ Fix:${RESET} ${f.recommendation}`)
      lines.push('')
    }

    if (output.findings.length > 8) {
      lines.push(`  ${DIM}... and ${output.findings.length - 8} more findings.${RESET}`)
      lines.push('')
    }
  }

  // Quick Action Hint
  lines.push(`${DIM}💡 Tip: Run \`geo-copilot generate ${url} --type llms_txt\` to generate production artifacts.${RESET}`)
  lines.push('')

  return lines.join('\n')
}

function renderBar(current: number, max: number, length: number): string {
  const percentage = Math.max(0, Math.min(1, current / max))
  const filledLength = Math.round(percentage * length)
  const emptyLength = length - filledLength

  let color = GREEN
  if (percentage < 0.4) color = RED
  else if (percentage < 0.7) color = YELLOW

  return `${color}${'█'.repeat(filledLength)}${DIM}${'░'.repeat(emptyLength)}${RESET}`
}

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A':
      return GREEN
    case 'B':
      return CYAN
    case 'C':
      return YELLOW
    case 'D':
      return RED
    default:
      return RED
  }
}

function getGradeBg(grade: string): string {
  switch (grade) {
    case 'A':
      return BG_GREEN
    case 'B':
      return BG_BLUE
    case 'C':
      return BG_YELLOW
    default:
      return BG_RED
  }
}

function getSeverityBadge(sev: string): string {
  switch (sev) {
    case 'critical':
      return `${RED}[CRITICAL]${RESET}`
    case 'high':
      return `${RED}[HIGH]${RESET}`
    case 'medium':
      return `${YELLOW}[MEDIUM]${RESET}`
    case 'low':
      return `${BLUE}[LOW]${RESET}`
    default:
      return `${DIM}[INFO]${RESET}`
  }
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.substring(0, len - 3) + '...' : str
}
