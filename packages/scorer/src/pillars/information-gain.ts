import * as cheerio from 'cheerio'
import type { CrawlResult } from '@geo-copilot/core'
import type { PillarResult } from '../types.js'

// Patterns that indicate factual, high-information content
const QUANTITATIVE_PATTERNS = [
  /\d+(\.\d+)?\s*(ms|milliseconds|seconds|s|minutes|hours|GB|MB|KB|TB|%|x|X|rpm|rps|req\/s)/gi,
  /\d+\s*(users|customers|companies|teams|requests|deployments|stars|downloads)/gi,
  /\$\d+(\.\d{2})?/g, // prices
  /\d+(\.\d+)?x\s*(faster|slower|cheaper|more|less)/gi,
  /p(50|75|90|95|99)\s*[:<=>]/gi, // percentile latency
  /latency[:\s]+\d+/gi,
  /throughput[:\s]+\d+/gi,
]

// Marketing slop patterns (penalize)
const SLOP_PATTERNS = [
  /revolutionary|game.?changing|disruptive|paradigm.?shift/gi,
  /best.?in.?class|world.?class|enterprise.?grade/gi,
  /seamless(ly)?|effortless(ly)?|intuitive|easy.?to.?use/gi,
  /unlock (your|the) (potential|power|future)/gi,
  /next.?level|take.*to the next level/gi,
  /leverage.*synerg/gi,
]

/**
 * Information Gain (ΔI) Scorer (max 20 points)
 *
 * Points breakdown:
 * - Quantitative claims detected:         +6 (1 per pattern type, max 6)
 * - Benchmark / comparison data:          +4
 * - Data tables present:                  +3
 * - Low marketing slop density:           +4
 * - Factual density (words per claim):    +3
 */
export function scoreInformationGain(crawl: CrawlResult): PillarResult {
  let score = 0
  const findings: PillarResult['findings'] = []

  const html = crawl.ssrHtml ?? crawl.hydratedHtml
  if (!html) {
    return {
      score: 0,
      summary: 'No HTML available for information gain analysis.',
      findings: [
        {
          pillar: 'information_gain',
          severity: 'critical',
          title: 'No content available for analysis',
          description: 'Could not retrieve page content to analyze information gain.',
          recommendation: 'Ensure the page returns SSR HTML.',
          location: { type: 'url', value: crawl.url },
          autoFixable: false,
          estimatedImpact: 5,
        },
      ],
    }
  }

  const $ = cheerio.load(html)

  // Remove nav, footer, header, scripts, styles for content analysis
  $('nav, footer, header, script, style, noscript').remove()
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
  const wordCount = bodyText.split(' ').filter(Boolean).length

  // 1. Quantitative claims (max 6)
  let quantClaims = 0
  for (const pattern of QUANTITATIVE_PATTERNS) {
    const matches = bodyText.match(pattern)
    if (matches && matches.length > 0) quantClaims++
  }
  const quantScore = Math.min(quantClaims, 6)
  score += quantScore

  if (quantClaims < 3) {
    findings.push({
      pillar: 'information_gain',
      severity: quantClaims === 0 ? 'high' : 'medium',
      title: `Low quantitative claim density (${quantClaims} types found)`,
      description: 'AI engines favor pages with concrete numbers, measurements, latency figures, and benchmark data. Abstract claims without numbers are rarely cited.',
      recommendation: 'Add specific metrics: response times (e.g., "p99 latency < 50ms"), scale claims ("handles 10,000 req/s"), and comparison data ("3x faster than X").',
      location: { type: 'url', value: crawl.url },
      autoFixable: false,
      estimatedImpact: 5,
    })
  }

  // 2. Tables (max 3)
  const tableCount = $('table').length
  if (tableCount >= 2) {
    score += 3
  } else if (tableCount === 1) {
    score += 1
    findings.push({
      pillar: 'information_gain',
      severity: 'medium',
      title: 'Few comparison tables',
      description: 'Markdown tables and comparison matrices are highly cited by AI engines because they present structured data clearly.',
      recommendation: 'Add feature comparison tables, benchmark tables, and pricing comparison tables where relevant.',
      location: { type: 'url', value: crawl.url },
      autoFixable: false,
      estimatedImpact: 2,
    })
  } else {
    findings.push({
      pillar: 'information_gain',
      severity: 'high',
      title: 'No comparison tables found',
      description: 'No HTML tables were detected. Structured tabular data (feature comparisons, benchmarks, pricing) is one of the highest-impact GEO elements.',
      recommendation: 'Add at least 2–3 comparison tables: feature matrix vs competitors, performance benchmarks, and pricing tiers.',
      location: { type: 'url', value: crawl.url },
      autoFixable: false,
      estimatedImpact: 3,
    })
  }

  // 3. Benchmark / performance data (max 4)
  const hasBenchmarkSection =
    $('h1, h2, h3').filter((_, el) =>
      /benchmark|performance|speed|latency|throughput|comparison/i.test($(el).text())
    ).length > 0
  const hasBenchmarkText =
    /benchmark|\d+ms|\d+ms \(p99\)|p99|throughput|\d+ req\/s/i.test(bodyText)

  if (hasBenchmarkSection && hasBenchmarkText) {
    score += 4
  } else if (hasBenchmarkText) {
    score += 2
  } else {
    findings.push({
      pillar: 'information_gain',
      severity: 'medium',
      title: 'No benchmark or performance data found',
      description: 'Performance benchmarks are frequently cited by AI engines when users ask about "fastest" or "best" tools.',
      recommendation: 'Add a dedicated Benchmarks or Performance section with real numbers. Cite methodology and comparison methodology.',
      location: { type: 'url', value: crawl.url },
      autoFixable: false,
      estimatedImpact: 3,
    })
  }

  // 4. Marketing slop detection (max 4 penalty or bonus)
  let slopMatches = 0
  for (const pattern of SLOP_PATTERNS) {
    const matches = bodyText.match(pattern)
    if (matches) slopMatches += matches.length
  }

  const slopDensity = wordCount > 0 ? slopMatches / wordCount : 0

  if (slopDensity < 0.001) {
    score += 4 // Clean content
  } else if (slopDensity < 0.003) {
    score += 2
  } else {
    score += 0
    findings.push({
      pillar: 'information_gain',
      severity: 'medium',
      title: `High marketing slop density (${slopMatches} phrases detected)`,
      description: `Detected ${slopMatches} marketing buzzword phrases. AI engines deprioritize content with low information density and high marketing language.`,
      recommendation: 'Replace vague marketing language with specific, measurable claims. Example: instead of "seamless integration", say "integrates in < 5 minutes with zero configuration".',
      location: { type: 'url', value: crawl.url },
      autoFixable: false,
      estimatedImpact: 3,
    })
  }

  // 5. Factual density: ratio of words to meaningful content sections
  const headingCount = $('h1, h2, h3, h4').length
  const factualDensityScore = wordCount > 500 && headingCount > 3 ? 3 : wordCount > 200 ? 1 : 0
  score += factualDensityScore

  if (wordCount < 300) {
    findings.push({
      pillar: 'information_gain',
      severity: 'high',
      title: `Low content volume (${wordCount} words)`,
      description: 'Pages with fewer than 500 words rarely have enough information for AI engines to cite authoritatively.',
      recommendation: 'Expand content with technical details, use cases, and examples. Aim for 800–1500 words on key landing pages.',
      location: { type: 'url', value: crawl.url },
      autoFixable: false,
      estimatedImpact: 4,
    })
  }

  const clampedScore = Math.min(Math.max(Math.round(score), 0), 20)
  return {
    score: clampedScore,
    summary: buildInfoGainSummary(clampedScore, quantClaims, slopMatches),
    findings,
  }
}

function buildInfoGainSummary(score: number, quantClaims: number, slopMatches: number): string {
  if (score >= 18) return `High information density: ${quantClaims} quantitative claim types, ${slopMatches} slop phrases.`
  if (score >= 14) return `Good factual content with room for more quantitative data.`
  if (score >= 10) return `Moderate information gain. Add benchmarks and reduce marketing language.`
  if (score >= 5) return `Low factual density. AI engines unlikely to cite this content.`
  return `Very low information gain. Content is mostly marketing copy without measurable claims.`
}
