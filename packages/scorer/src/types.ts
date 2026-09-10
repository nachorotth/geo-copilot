import type { CrawlResult, StaticAnalysisResult, PillarScores, Finding } from '@geo-copilot/core'

export interface ScoringInput {
  crawlResult?: CrawlResult
  staticAnalysis?: StaticAnalysisResult
  previousSoMV?: number // 0–100 from last SoMV snapshot, null if not measured
}

export interface ScoringOutput {
  total: number // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  pillars: PillarScores
  findings: Finding[]
}

export interface PillarResult {
  score: number // 0–20
  summary: string
  findings: Omit<Finding, 'id' | 'auditRunId' | 'createdAt'>[]
}
