import OpenAI from 'openai'
import type { AIEngine } from '@geo-copilot/core'

export interface ProbeResult {
  engine: AIEngine
  prompt: string
  response: string
  durationMs: number
  error?: string
}

/**
 * OpenAI ChatGPT Search probe adapter.
 * Uses the Responses API with web_search_preview tool to simulate ChatGPT Search.
 */
export class OpenAIProbeAdapter {
  private client: OpenAI

  constructor(apiKey?: string) {
    this.client = new OpenAI({ apiKey: apiKey ?? process.env.OPENAI_API_KEY })
  }

  async probe(prompt: string): Promise<ProbeResult> {
    const start = Date.now()
    try {
      const response = await this.client.responses.create({
        model: 'gpt-4o-mini',
        tools: [{ type: 'web_search_preview' }],
        input: prompt,
      })

      const text = response.output
        .filter((o) => o.type === 'message')
        .flatMap((o: any) =>
          o.content.filter((c: any) => c.type === 'output_text').map((c: any) => c.text)
        )
        .join('\n')

      return {
        engine: 'chatgpt_search',
        prompt,
        response: text,
        durationMs: Date.now() - start,
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
