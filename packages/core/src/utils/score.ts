import type { PillarScore } from '../types/index.js'

export function computeGrade(score: number, max: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (max <= 0 || Number.isNaN(score) || Number.isNaN(max)) return 'F'
  const pct = (score / max) * 100
  if (pct >= 90) return 'A'
  if (pct >= 75) return 'B'
  if (pct >= 60) return 'C'
  if (pct >= 40) return 'D'
  return 'F'
}

export function computeSoMV(
  results: Array<{ classification: 'recommendation' | 'citation' | 'mention' | 'none' } | { classification: string }>
): number {
  const N = results.length
  if (N === 0) return 0
  const weights: Record<string, number> = { recommendation: 1.0, citation: 0.7, mention: 0.4, none: 0.0 }
  const sum = results.reduce((acc, r) => acc + (weights[r.classification] ?? 0.0), 0)
  return (sum / N) * 100
}

export function pillarScoreToGrade(pillar: PillarScore): 'A' | 'B' | 'C' | 'D' | 'F' {
  return computeGrade(pillar.score, pillar.maxScore)
}

export function computeTotalGeoScore(pillarScores: Record<string, PillarScore>): number {
  return Object.values(pillarScores).reduce((sum, p) => sum + p.score, 0)
}
