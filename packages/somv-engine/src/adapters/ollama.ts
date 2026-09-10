import type { AIEngine } from '@geo-copilot/core'

export interface LocalProbeResult {
  engine: AIEngine
  prompt: string
  response: string
  durationMs: number
  error?: string
}

export class OllamaProbeAdapter {
  private baseUrl: string
  private defaultModel: string

  constructor(baseUrl?: string, defaultModel?: string) {
    this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    this.defaultModel = defaultModel || process.env.OLLAMA_MODEL || 'llama3.2'
  }

  async probe(prompt: string, model?: string): Promise<LocalProbeResult> {
    const start = Date.now()
    const targetModel = model || this.defaultModel

    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: targetModel,
          prompt,
          stream: false,
        }),
      })

      if (!res.ok) {
        throw new Error(`Ollama returned status ${res.status}: ${res.statusText}`)
      }

      const json = (await res.json()) as { response?: string }
      const durationMs = Date.now() - start


      return {
        engine: 'chatgpt_search', // maps to LLM response for scoring
        prompt,
        response: json.response || '',
        durationMs,
      }
    } catch (err) {
      return {
        engine: 'chatgpt_search',
        prompt,
        response: '',
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }
}
