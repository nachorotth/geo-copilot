export const AI_BOT_USER_AGENTS = [
  { engine: 'chatgpt_search', ua: 'OAI-SearchBot', description: 'OpenAI ChatGPT Search crawler' },
  { engine: 'chatgpt_search', ua: 'ChatGPT-User', description: 'OpenAI on-demand query fetcher' },
  { engine: 'perplexity', ua: 'PerplexityBot', description: 'Perplexity answer engine' },
  { engine: 'claude', ua: 'Claude-Web', description: 'Anthropic Claude with Search' },
  { engine: 'gemini', ua: 'Google-Extended', description: 'Google Gemini / AI Overviews' },
  { engine: 'copilot', ua: 'Bingbot', description: 'Microsoft Bing + Copilot (same crawler)' },
  { engine: 'grok', ua: 'Grok', description: 'xAI Grok DeepSearch' },
  { engine: 'grok', ua: 'GrokBot', description: 'xAI Grok alternative UA' },
] as const

export const PILLAR_MAX_SCORE = 20
export const TOTAL_MAX_SCORE = 100

export const MUTATION_CLASS_LABELS: Record<'A' | 'B' | 'C', string> = {
  A: 'Read-only analysis (no changes)',
  B: 'Reversible content changes (llms.txt, JSON-LD, docs)',
  C: 'High blast-radius (robots, middleware, routing, layout)',
}

export const LLMS_TXT_LINK_REL = 'describedby'
export const LLMS_TXT_PATH = '/llms.txt'
export const LLMS_FULL_TXT_PATH = '/llms-full.txt'

