import type { SoMVClassification } from '@geo-copilot/core'

/**
 * Classifies an AI engine response as Recommendation, Citation, Mention, or None.
 *
 * Weights:
 * - Recommendation: 1.0 ("I recommend X", "X is the best tool for", "use X")
 * - Citation: 0.7 ("According to X", "X docs state", source: X)
 * - Mention: 0.4 ("X is a tool that", "you can also try X")
 * - None: 0.0 (no mention)
 */

const RECOMMENDATION_PATTERNS = [
  /\bI\s+(?:would\s+)?recommend\b/i,
  /\bbest\s+(?:tool|option|choice|solution|platform)\b/i,
  /\btop\s+(?:tool|option|choice|pick)\b/i,
  /\buse\b.{0,30}\bfor\b/i,
  /\bsuggested?\b/i,
  /\bgo\s+with\b/i,
  /\bprefer(?:red)?\b/i,
  /\bour\s+(?:pick|choice|recommendation)\b/i,
  /\#1\s+(?:choice|option|pick|tool)\b/i,
]

const CITATION_PATTERNS = [
  /according\s+to/i,
  /as\s+(?:stated|mentioned|documented|described)\s+(?:by|in)/i,
  /source:/i,
  /via\b/i,
  /from\s+their\s+(?:docs|documentation|website|page)/i,
  /\[\d+\]/,  // numbered citations
  /\(https?:\/\//i,  // inline URL citations
]

const MENTION_PATTERNS = [
  /\bis\s+a\s+(?:tool|platform|service|product)\b/i,
  /\balso\s+(?:try|consider|available)\b/i,
  /\bother\s+(?:options?|alternatives?)\b/i,
  /\bincluding\b/i,
  /\bsuch\s+as\b/i,
]

export function classifyResponse(
  response: string,
  targetBrand: string
): { classification: SoMVClassification; weightedScore: number; snippets: string[] } {
  // Check if brand is mentioned at all
  const brandRegex = new RegExp(targetBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  if (!brandRegex.test(response)) {
    return { classification: 'none', weightedScore: 0, snippets: [] }
  }

  // Extract sentences containing the brand
  const sentences = response.split(/(?<=[.!?])\s+/)
  const brandSentences = sentences.filter((s) => brandRegex.test(s))

  const snippets = brandSentences.slice(0, 3) // max 3 snippets

  // Check for Recommendation (highest priority, checked first)
  for (const sentence of brandSentences) {
    for (const pattern of RECOMMENDATION_PATTERNS) {
      if (pattern.test(sentence)) {
        return { classification: 'recommendation', weightedScore: 1.0, snippets }
      }
    }
  }

  // Check for Citation
  for (const sentence of brandSentences) {
    for (const pattern of CITATION_PATTERNS) {
      if (pattern.test(sentence)) {
        return { classification: 'citation', weightedScore: 0.7, snippets }
      }
    }
  }

  // Check for Mention
  for (const sentence of brandSentences) {
    for (const pattern of MENTION_PATTERNS) {
      if (pattern.test(sentence)) {
        return { classification: 'mention', weightedScore: 0.4, snippets }
      }
    }
  }

  // Brand found but no classification pattern matched — still a mention
  return { classification: 'mention', weightedScore: 0.4, snippets }
}

export function computeSoMVScore(
  results: Array<{ weightedScore: number }>
): number {
  if (results.length === 0) return 0
  const sum = results.reduce((acc, r) => acc + r.weightedScore, 0)
  return (sum / results.length) * 100
}
