import type { PillarScores, Finding } from '@geo-copilot/core'
import { computeGrade } from '@geo-copilot/core'
import type { ScoringInput, ScoringOutput, PillarResult } from './types.js'
import { scoreCrawlerLayer } from './pillars/crawler-layer.js'
import { scoreKnowledgeGraph } from './pillars/knowledge-graph.js'
import { scoreInformationGain } from './pillars/information-gain.js'
import { scoreBLUFArchitecture } from './pillars/bluf-architecture.js'
import { scoreSoMV } from './pillars/somv.js'
import { createId } from '@paralleldrive/cuid2'

export class GEOScoringEngine {
  score(input: ScoringInput): ScoringOutput {
    const { crawlResult, staticAnalysis, previousSoMV } = input

    const crawlerResult: PillarResult = crawlResult
      ? scoreCrawlerLayer(crawlResult)
      : emptyPillar('crawler_layer', 'No crawl data available')

    const knowledgeGraphResult: PillarResult =
      crawlResult || staticAnalysis
        ? scoreKnowledgeGraph(crawlResult!, staticAnalysis)
        : emptyPillar('knowledge_graph', 'No crawl or static analysis data available')

    const infoGainResult: PillarResult = crawlResult
      ? scoreInformationGain(crawlResult)
      : emptyPillar('information_gain', 'No crawl data available')

    const blufResult: PillarResult = crawlResult
      ? scoreBLUFArchitecture(crawlResult)
      : emptyPillar('bluf_architecture', 'No crawl data available')

    const somvResult: PillarResult = scoreSoMV(previousSoMV)

    const total =
      crawlerResult.score +
      knowledgeGraphResult.score +
      infoGainResult.score +
      blufResult.score +
      somvResult.score

    const makePillarScore = (result: PillarResult) => ({
      score: result.score,
      maxScore: 20 as const,
      grade: computeGrade(result.score, 20),
      summary: result.summary,
    })

    const pillarScores: PillarScores = {
      crawler_layer: makePillarScore(crawlerResult),
      knowledge_graph: makePillarScore(knowledgeGraphResult),
      information_gain: makePillarScore(infoGainResult),
      bluf_architecture: makePillarScore(blufResult),
      somv: makePillarScore(somvResult),
    }

    // Flatten all findings and assign IDs
    const now = new Date()
    const findings: Finding[] = [
      ...crawlerResult.findings,
      ...knowledgeGraphResult.findings,
      ...infoGainResult.findings,
      ...blufResult.findings,
      ...somvResult.findings,
    ].map((f) => ({
      ...f,
      id: createId(),
      auditRunId: '', // will be set by the caller after DB insert
      createdAt: now,
      location: f.location ?? null,
    }))

    return {
      total: Math.min(Math.max(total, 0), 100),
      grade: computeGrade(total, 100),
      pillars: pillarScores,
      findings,
    }
  }
}

function emptyPillar(pillar: string, summary: string): PillarResult {
  return {
    score: 0,
    summary,
    findings: [],
  }
}
