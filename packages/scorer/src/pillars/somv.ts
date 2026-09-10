import type { PillarResult } from '../types.js'

/**
 * SoMV Pillar Scorer (max 20 points)
 *
 * When SoMV data is available, it directly maps:
 * - SoMV 80–100 → 20 points
 * - SoMV 60–79  → 16 points
 * - SoMV 40–59  → 12 points
 * - SoMV 20–39  → 8 points
 * - SoMV 0–19   → 4 points
 * - Not measured → 0 points (with "not yet measured" finding)
 */
export function scoreSoMV(previousSoMV?: number | null): PillarResult {
  if (previousSoMV == null || previousSoMV === undefined) {
    return {
      score: 0,
      summary: 'SoMV not yet measured. Enable SoMV monitoring in project settings to track AI citation rates.',
      findings: [
        {
          pillar: 'somv',
          severity: 'info',
          title: 'SoMV monitoring not yet enabled',
          description: 'Share of Model Voice (SoMV) measures how often AI search engines recommend, cite, or mention your product. Enable monitoring to track this metric continuously.',
          recommendation: 'Enable SoMV monitoring in project settings. GEOAgent will run weekly synthetic probe batches across Perplexity, ChatGPT Search, Gemini, Claude, Copilot, and Grok.',
          location: null,
          autoFixable: false,
          estimatedImpact: 0,
        },
      ],
    }
  }

  let pillarScore: number
  if (previousSoMV >= 80) pillarScore = 20
  else if (previousSoMV >= 60) pillarScore = 16
  else if (previousSoMV >= 40) pillarScore = 12
  else if (previousSoMV >= 20) pillarScore = 8
  else pillarScore = 4

  const findings: PillarResult['findings'] = []

  if (previousSoMV < 40) {
    findings.push({
      pillar: 'somv',
      severity: previousSoMV < 20 ? 'high' : 'medium',
      title: `Low SoMV: ${previousSoMV.toFixed(1)}`,
      description: `Your Share of Model Voice is ${previousSoMV.toFixed(1)}/100. AI engines are not recommending or citing your product for relevant queries.`,
      recommendation: 'Apply the other 4 GEO pillars to improve content quality and AI crawler access. Increasing SoMV is a downstream effect of strong Crawler Layer, Knowledge Graph, ΔI, and BLUF scores.',
      location: null,
      autoFixable: false,
      estimatedImpact: 5,
    })
  }

  return {
    score: pillarScore,
    summary: `SoMV: ${previousSoMV.toFixed(1)}/100 — ${getSoMVLabel(previousSoMV)}`,
    findings,
  }
}

function getSoMVLabel(somv: number): string {
  if (somv >= 80) return 'Strong AI presence. Frequently cited and recommended.'
  if (somv >= 60) return 'Good AI visibility. Cited in most relevant categories.'
  if (somv >= 40) return 'Moderate AI presence. Mentioned but not consistently recommended.'
  if (somv >= 20) return 'Weak AI presence. Rarely cited or mentioned.'
  return 'Minimal AI presence. Not appearing in relevant AI search results.'
}
