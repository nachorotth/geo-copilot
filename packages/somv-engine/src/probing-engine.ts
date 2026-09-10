import type { AIEngine, SoMVClassification, ProberGateway, ProbeResult } from '@geo-copilot/core'
import { classifyResponse, computeSoMVScore } from './classifier.js'
import { OpenAIProbeAdapter } from './adapters/openai.js'
import { OllamaProbeAdapter } from './adapters/ollama.js'

export interface ProbeJob {
  prompt: string
  engines: AIEngine[]
  targetBrand: string
}

export interface ProbeJobResult {
  prompt: string
  engine: AIEngine
  classification: SoMVClassification
  weightedScore: number
  responseSnippet: string
  fullResponse: string
  durationMs: number
  error?: string
}

export interface SoMVBatchResult {
  jobs: ProbeJobResult[]
  overallSoMV: number
  byEngine: Record<AIEngine, { soMV: number; probeCount: number }>
  targetBrand: string
  completedAt: Date
}

export interface DirectBYOKProberOptions {
  openaiApiKey?: string
  ollamaBaseUrl?: string
}

export class DirectBYOKProberGateway implements ProberGateway {
  readonly name = 'direct_byok'
  private openaiAdapter: OpenAIProbeAdapter | null = null
  private ollamaAdapter: OllamaProbeAdapter | null = null

  constructor(options: DirectBYOKProberOptions = {}) {
    if (options.openaiApiKey || process.env.OPENAI_API_KEY) {
      this.openaiAdapter = new OpenAIProbeAdapter(options.openaiApiKey)
    }
    if (options.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || process.env.LOCAL_LLM === 'true') {
      this.ollamaAdapter = new OllamaProbeAdapter(options.ollamaBaseUrl)
    }
  }

  async probe(
    prompt: string,
    engine: AIEngine,
    _options?: { targetBrand?: string }
  ): Promise<ProbeResult> {
    if (this.ollamaAdapter) {
      return this.ollamaAdapter.probe(prompt)
    }

    switch (engine) {
      case 'chatgpt_search':
        if (!this.openaiAdapter) {
          return {
            engine,
            prompt,
            response: '',
            durationMs: 0,
            error: 'OpenAI API key not configured (or start Ollama locally)',
          }
        }
        return this.openaiAdapter.probe(prompt)

      default:
        return {
          engine,
          prompt,
          response: '',
          durationMs: 0,
          error: `Engine adapter for '${engine}' not yet implemented in v1.0`,
        }
    }
  }
}

export interface SoMVProbingEngineOptions {
  openaiApiKey?: string
  ollamaBaseUrl?: string
  gateway?: ProberGateway
}

export class SoMVProbingEngine {
  private gateway: ProberGateway

  constructor(options: SoMVProbingEngineOptions = {}) {
    this.gateway =
      options.gateway ??
      new DirectBYOKProberGateway({
        openaiApiKey: options.openaiApiKey,
        ollamaBaseUrl: options.ollamaBaseUrl,
      })
  }


  async runBatch(
    jobs: ProbeJob[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<SoMVBatchResult> {
    const results: ProbeJobResult[] = []
    let completed = 0
    const total = jobs.reduce((sum, j) => sum + j.engines.length, 0)

    for (const job of jobs) {
      for (const engine of job.engines) {
        const probeResult = await this.probe(job.prompt, engine, job.targetBrand)
        const classified = classifyResponse(probeResult.response, job.targetBrand)

        results.push({
          prompt: job.prompt,
          engine,
          classification: classified.classification,
          weightedScore: classified.weightedScore,
          responseSnippet: classified.snippets.join(' ... ').slice(0, 500),
          fullResponse: probeResult.response,
          durationMs: probeResult.durationMs,
          error: probeResult.error,
        })

        completed++
        onProgress?.(completed, total)

        // Rate limiting: 500ms between probes
        if (completed < total) await new Promise((r) => setTimeout(r, 500))
      }
    }

    const overallSoMV = computeSoMVScore(results)

    // Compute per-engine SoMV
    const byEngine: Record<string, { soMV: number; probeCount: number }> = {}
    for (const result of results) {
      if (!byEngine[result.engine]) {
        byEngine[result.engine] = { soMV: 0, probeCount: 0 }
      }
      byEngine[result.engine]!.probeCount++
    }
    for (const engine of Object.keys(byEngine) as AIEngine[]) {
      const engineResults = results.filter((r) => r.engine === engine)
      byEngine[engine]!.soMV = computeSoMVScore(engineResults)
    }

    return {
      jobs: results,
      overallSoMV,
      byEngine: byEngine as Record<AIEngine, { soMV: number; probeCount: number }>,
      targetBrand: jobs[0]?.targetBrand ?? '',
      completedAt: new Date(),
    }
  }

  private async probe(prompt: string, engine: AIEngine, targetBrand?: string): Promise<ProbeResult> {
    return this.gateway.probe(prompt, engine, { targetBrand })
  }
}

