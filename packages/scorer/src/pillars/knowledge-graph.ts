import * as cheerio from 'cheerio'
import type { CrawlResult, StaticAnalysisResult } from '@geo-copilot/core'
import type { PillarResult } from '../types.js'

const REQUIRED_SCHEMA_TYPES = ['Organization', 'WebSite', 'SoftwareApplication']
const RECOMMENDED_SCHEMA_TYPES = ['TechArticle', 'FAQPage', 'BreadcrumbList']
const SAMEAS_AUTHORITIES = ['wikidata.org', 'crunchbase.com', 'github.com']

/**
 * Knowledge Graph Scorer (max 20 points)
 *
 * Points breakdown:
 * - JSON-LD script tag present:           +3
 * - @graph structure used:                +2
 * - Required schema types present:        +6 (2 each: Org, WebSite, SoftwareApp)
 * - Recommended types present:            +3 (1 each up to 3)
 * - sameAs with authoritative sources:    +4 (Wikidata P0, Crunchbase P1, GitHub P1)
 * - inLanguage present:                   +1
 * - Valid @context:                        +1
 */
export function scoreKnowledgeGraph(
  crawl?: CrawlResult,
  staticAnalysis?: StaticAnalysisResult
): PillarResult {
  let score = 0
  const findings: PillarResult['findings'] = []
  const targetUrl = crawl?.url ?? staticAnalysis?.repoUrl ?? 'Repository'

  // If no live crawl data available, analyze static analysis if present
  if (!crawl) {
    const staticJsonLdTypes = staticAnalysis?.routes.flatMap((r) => r.jsonLdTypes) ?? []
    if (staticJsonLdTypes.length === 0) {
      findings.push({
        pillar: 'knowledge_graph',
        severity: 'critical',
        title: 'No JSON-LD structured data found in repository',
        description: 'No JSON-LD script tags or schemas detected across analyzed Next.js App Router routes.',
        recommendation: 'Add a JSON-LD @graph component with Organization, WebSite, and SoftwareApplication schema types.',
        location: { type: 'file', value: 'src/components/JsonLdGraph.tsx' },
        autoFixable: true,
        estimatedImpact: 10,
      })
      return { score: 0, summary: 'No JSON-LD found in repository routes.', findings }
    }

    const foundTypes = Array.from(new Set(staticJsonLdTypes))
    score += 3
    for (const reqType of REQUIRED_SCHEMA_TYPES) {
      if (foundTypes.includes(reqType)) score += 2
    }
    const clamped = Math.min(Math.max(score, 0), 20)
    return {
      score: clamped,
      summary: buildKnowledgeGraphSummary(clamped, foundTypes),
      findings,
    }
  }

  // Parse JSON-LD from SSR HTML
  const html = crawl.ssrHtml ?? crawl.hydratedHtml
  if (!html) {
    findings.push({
      pillar: 'knowledge_graph',
      severity: 'critical',
      title: 'No HTML available for JSON-LD analysis',
      description: 'Could not retrieve page HTML to analyze structured data.',
      recommendation: 'Ensure the page is accessible and returns SSR HTML.',
      location: { type: 'url', value: targetUrl },
      autoFixable: false,
      estimatedImpact: 8,
    })
    return { score: 0, summary: 'No HTML available for analysis.', findings }
  }

  const $ = cheerio.load(html)
  const jsonLdScripts: unknown[] = []

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() ?? '{}')
      jsonLdScripts.push(parsed)
    } catch {
      // invalid JSON-LD
    }
  })

  // Also check static analysis for JSON-LD
  const staticJsonLdTypes = staticAnalysis?.routes.flatMap((r) => r.jsonLdTypes) ?? []

  if (jsonLdScripts.length === 0) {
    findings.push({
      pillar: 'knowledge_graph',
      severity: 'critical',
      title: 'No JSON-LD structured data found',
      description: 'No <script type="application/ld+json"> was found. JSON-LD is the primary way AI engines and search engines understand your product entity.',
      recommendation: 'Add a JSON-LD @graph with Organization, WebSite, and SoftwareApplication schema types. GEOAgent can generate this automatically.',
      location: { type: 'url', value: targetUrl },
      autoFixable: true,
      estimatedImpact: 10,
    })
    return { score: 0, summary: 'No JSON-LD found. Critical knowledge graph gap.', findings }
  }

  score += 3 // JSON-LD present

  // Flatten all schemas for analysis
  const allSchemas: Record<string, unknown>[] = []
  for (const script of jsonLdScripts) {
    if (typeof script === 'object' && script !== null) {
      const s = script as Record<string, unknown>
      if (s['@graph'] && Array.isArray(s['@graph'])) {
        score += 2 // @graph used
        allSchemas.push(...(s['@graph'] as Record<string, unknown>[]))
      } else {
        allSchemas.push(s)
      }
    }
  }

  // Check @graph was used
  const usesGraph = jsonLdScripts.some(
    (s) => typeof s === 'object' && s !== null && '@graph' in (s as object)
  )
  if (!usesGraph) {
    findings.push({
      pillar: 'knowledge_graph',
      severity: 'medium',
      title: 'JSON-LD @graph structure not used',
      description: 'Individual JSON-LD objects are present but not connected via @graph. The @graph pattern explicitly links Organization, SoftwareApplication, and article entities, improving AI entity disambiguation.',
      recommendation: 'Consolidate all schema objects into a single <script> with @graph and unique @id for each entity.',
      location: { type: 'url', value: targetUrl },
      autoFixable: true,
      estimatedImpact: 3,
    })
  }

  // Extract all @type values
  const foundTypes = allSchemas.flatMap((s) => {
    const t = s['@type']
    return Array.isArray(t) ? t : t ? [t] : []
  }).map(String)

  // Check required types
  for (const requiredType of REQUIRED_SCHEMA_TYPES) {
    if (foundTypes.includes(requiredType)) {
      score += 2
    } else {
      findings.push({
        pillar: 'knowledge_graph',
        severity: 'high',
        title: `Missing required schema type: ${requiredType}`,
        description: `The ${requiredType} schema type is missing. This is required for AI engines to correctly identify and classify your product.`,
        recommendation: `Add a ${requiredType} entity to your JSON-LD @graph.`,
        location: { type: 'url', value: targetUrl },
        autoFixable: true,
        estimatedImpact: 2,
      })
    }
  }

  // Check recommended types
  let recommendedFound = 0
  for (const recType of RECOMMENDED_SCHEMA_TYPES) {
    if (foundTypes.includes(recType)) {
      score += 1
      recommendedFound++
    }
  }
  if (recommendedFound < 2) {
    findings.push({
      pillar: 'knowledge_graph',
      severity: 'medium',
      title: 'Missing recommended schema types',
      description: `Found ${recommendedFound}/${RECOMMENDED_SCHEMA_TYPES.length} recommended types (${RECOMMENDED_SCHEMA_TYPES.join(', ')}). These help AI engines surface your content for specific query types.`,
      recommendation: 'Add TechArticle to documentation pages, FAQPage for FAQ sections.',
      location: { type: 'url', value: targetUrl },
      autoFixable: true,
      estimatedImpact: 2,
    })
  }

  // Check sameAs with authoritative sources
  const allSameAs = allSchemas
    .flatMap((s) => {
      const sa = s['sameAs']
      return Array.isArray(sa) ? sa : sa ? [sa] : []
    })
    .map(String)

  let sameAsScore = 0
  for (const authority of SAMEAS_AUTHORITIES) {
    if (allSameAs.some((url) => url.includes(authority))) {
      sameAsScore++
    } else {
      findings.push({
        pillar: 'knowledge_graph',
        severity: authority === 'wikidata.org' ? 'high' : 'medium',
        title: `Missing sameAs link to ${authority}`,
        description: `No sameAs reference to ${authority} was found. ${authority === 'wikidata.org' ? 'Wikidata is the most critical authority for AI entity disambiguation.' : `${authority} helps establish commercial legitimacy.`}`,
        recommendation: `Add "sameAs": "https://${authority}/your-entity" to your Organization schema.`,
        location: { type: 'url', value: targetUrl },
        autoFixable: false,
        estimatedImpact: authority === 'wikidata.org' ? 3 : 1,
      })
    }
  }
  score += Math.min(sameAsScore * 1.5, 4) // Wikidata alone = 1.5, all three = 4

  // Check inLanguage
  const hasInLanguage = allSchemas.some((s) => 'inLanguage' in s)
  if (hasInLanguage) {
    score += 1
  }

  // Valid @context
  const hasValidContext = allSchemas.some(
    (s) => s['@context'] === 'https://schema.org' || s['@context'] === 'http://schema.org'
  )
  if (hasValidContext) {
    score += 1
  }

  const clampedScore = Math.min(Math.max(Math.round(score), 0), 20)
  return {
    score: clampedScore,
    summary: buildKnowledgeGraphSummary(clampedScore, foundTypes),
    findings,
  }
}

function buildKnowledgeGraphSummary(score: number, foundTypes: string[]): string {
  if (score >= 18) return `Strong knowledge graph with ${foundTypes.join(', ')} schema types and authoritative sameAs links.`
  if (score >= 14) return `Good knowledge graph. ${foundTypes.length} schema types found. Some sameAs or @graph improvements available.`
  if (score >= 10) return `Partial knowledge graph. Missing key schema types or @graph structure.`
  if (score >= 5) return `Weak knowledge graph. Only basic JSON-LD present. Entity disambiguation will be poor.`
  return `No structured data found. AI engines cannot identify or classify your product.`
}
