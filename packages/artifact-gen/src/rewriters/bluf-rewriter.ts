import OpenAI from 'openai'

export interface BLUFRewriterOptions {
  apiKey?: string
  model?: string
  maxTokensPerSection?: number
}

export interface BLUFRewriteResult {
  heading: string
  originalContent: string
  blufSummary: string // 40-60 token BLUF paragraph
  rewrittenContent: string
}

const BLUF_SYSTEM_PROMPT = `You are a technical content editor specializing in Generative Engine Optimization (GEO).
Your task is to rewrite content sections to follow BLUF (Bottom Line Up Front) architecture.

For each section provided, you will:
1. Write a 40-60 token BLUF summary that starts with the key fact/answer
2. The summary must be immediately useful without reading further
3. Include the most important number, comparison, or capability in the first sentence
4. Use active voice and avoid marketing language
5. Name specific entities (product names, standards, technologies) explicitly

Do NOT use: "In this section", "This guide", "We will", "It is important", or any throat-clearing phrases.`

const BLUF_USER_PROMPT = (heading: string, content: string) => `
Write a BLUF summary (40-60 tokens, 2-3 sentences) for this section:

Heading: ${heading}

Content:
${content.slice(0, 2000)} // truncate for safety

Respond with ONLY the BLUF paragraph. No labels, no explanations.
`

export class BLUFRewriter {
  private client: OpenAI
  private model: string

  constructor(options: BLUFRewriterOptions = {}) {
    this.client = new OpenAI({
      apiKey: options.apiKey ?? process.env.OPENAI_API_KEY,
    })
    this.model = options.model ?? 'gpt-4o-mini'
  }

  async rewriteSection(
    heading: string,
    content: string
  ): Promise<BLUFRewriteResult> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: BLUF_SYSTEM_PROMPT },
        { role: 'user', content: BLUF_USER_PROMPT(heading, content) },
      ],
      max_tokens: 150,
      temperature: 0.3,
    })

    const blufSummary = completion.choices[0]?.message?.content?.trim() ?? ''

    return {
      heading,
      originalContent: content,
      blufSummary,
      rewrittenContent: `${blufSummary}\n\n${content}`,
    }
  }

  async rewriteMultipleSections(
    sections: Array<{ heading: string; content: string }>,
    onProgress?: (index: number, total: number) => void
  ): Promise<BLUFRewriteResult[]> {
    const results: BLUFRewriteResult[] = []
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]
      if (!section) continue
      onProgress?.(i + 1, sections.length)
      const result = await this.rewriteSection(section.heading, section.content)
      results.push(result)
      // Rate limit: 100ms delay between requests
      if (i < sections.length - 1) await new Promise((r) => setTimeout(r, 100))
    }
    return results
  }
}
