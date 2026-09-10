import * as cheerio from 'cheerio'
import type { CrawlResult } from '@geo-copilot/core'
import type { PillarResult } from '../types.js'

// Token estimation: ~0.75 tokens per word in English
const estimateTokens = (text: string): number =>
  Math.round(text.split(/\s+/).filter(Boolean).length * 0.75)

/**
 * BLUF Architecture Scorer (max 20 points)
 *
 * Points breakdown:
 * - H2/H3 headings with immediate following paragraph: +6 (max)
 * - BLUF paragraphs are 40–60 tokens:                 +4
 * - Named entities present (proper nouns, brands):     +3
 * - High-density markdown/HTML tables:                 +3
 * - Code examples with context:                        +2
 * - Structured lists (not bullet soup):                +2
 */
export function scoreBLUFArchitecture(crawl: CrawlResult): PillarResult {
  let score = 0
  const findings: PillarResult['findings'] = []

  const html = crawl.ssrHtml ?? crawl.hydratedHtml
  if (!html) {
    return {
      score: 0,
      summary: 'No HTML available for BLUF analysis.',
      findings: [],
    }
  }

  const $ = cheerio.load(html)
  $('nav, footer, header, script, style').remove()

  // Analyze H2/H3 sections for BLUF compliance
  const headings = $('h2, h3').toArray()
  let blufCompliantHeadings = 0
  let shortParagraphs = 0
  let goodBLUFCount = 0

  for (const heading of headings) {
    const nextEl = $(heading).next()
    if (nextEl.is('p')) {
      blufCompliantHeadings++
      const text = nextEl.text().trim()
      const tokens = estimateTokens(text)
      if (tokens >= 30 && tokens <= 70) {
        goodBLUFCount++
      } else if (tokens < 30) {
        shortParagraphs++
      }
    }
  }

  // Score BLUF compliance
  if (headings.length > 0) {
    const blufRatio = blufCompliantHeadings / headings.length
    score += Math.round(blufRatio * 6)

    const goodBLUFRatio = headings.length > 0 ? goodBLUFCount / headings.length : 0
    score += Math.round(goodBLUFRatio * 4)

    if (blufRatio < 0.5) {
      findings.push({
        pillar: 'bluf_architecture',
        severity: 'high',
        title: `${Math.round((1 - blufRatio) * 100)}% of headings lack an immediate summary paragraph`,
        description: 'BLUF (Bottom Line Up Front) architecture requires a 40–60 token summary immediately under each H2/H3 heading. AI engines extract these as answer snippets.',
        recommendation: 'Add a 2–3 sentence summary (40–60 tokens) immediately under every H2/H3 heading. Start with the key takeaway, not background.',
        location: { type: 'url', value: crawl.url },
        autoFixable: true,
        estimatedImpact: 5,
      })
    }

    if (shortParagraphs > 2) {
      findings.push({
        pillar: 'bluf_architecture',
        severity: 'medium',
        title: `${shortParagraphs} headings have too-short summary paragraphs (< 30 tokens)`,
        description: 'Very short paragraphs after headings do not provide enough context for AI engines to generate good answer snippets.',
        recommendation: 'Expand short summaries to 40–60 tokens. Include the key fact, a qualifier, and the implication.',
        location: { type: 'url', value: crawl.url },
        autoFixable: true,
        estimatedImpact: 3,
      })
    }
  }

  // Named entities (capitalized proper nouns, technical terms)
  const bodyText = $('body').text()
  const namedEntityMatches = bodyText.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) ?? []
  const uniqueEntities = new Set(namedEntityMatches)
  if (uniqueEntities.size >= 5) {
    score += 3
  } else if (uniqueEntities.size >= 2) {
    score += 1
    findings.push({
      pillar: 'bluf_architecture',
      severity: 'medium',
      title: 'Few named entities detected',
      description: 'AI engines identify and track named entities (product names, company names, technical terms). High named entity density improves citation accuracy.',
      recommendation: 'Use full product names, company names, and technical terms explicitly. Avoid pronouns that obscure entity references.',
      location: { type: 'url', value: crawl.url },
      autoFixable: false,
      estimatedImpact: 2,
    })
  }

  // Tables
  const tableCount = $('table').length
  score += Math.min(tableCount, 3)

  // Code examples
  const codeBlockCount = $('pre code, pre').length
  score += Math.min(codeBlockCount, 2)

  // Structured lists
  const listCount = $('ul, ol').length
  const listItemCount = $('li').length
  if (listCount >= 3 && listItemCount >= 10) {
    score += 2
  } else if (listCount >= 1) {
    score += 1
  }

  const clampedScore = Math.min(Math.max(Math.round(score), 0), 20)
  return {
    score: clampedScore,
    summary: buildBLUFSummary(clampedScore, headings.length, blufCompliantHeadings),
    findings,
  }
}

function buildBLUFSummary(score: number, headings: number, bluf: number): string {
  if (score >= 18) return `Excellent BLUF architecture: ${bluf}/${headings} headings have proper summaries.`
  if (score >= 14) return `Good BLUF structure. Most headings have contextual summaries.`
  if (score >= 10) return `Partial BLUF implementation. Expand heading summaries to 40–60 tokens.`
  if (score >= 5) return `Weak BLUF architecture. Most headings lack immediate summary paragraphs.`
  return `No BLUF architecture detected. AI engines cannot extract answer snippets from this content.`
}
