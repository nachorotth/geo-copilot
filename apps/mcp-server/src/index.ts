#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { crawlUrl } from '@geo-copilot/crawler'
import { GEOScoringEngine } from '@geo-copilot/scorer'
import {
  generateLlmsTxtFromCrawl,
  generateJsonLdGraphFromCrawl,
  generateRobotsTs,
  generateMarkdownMiddlewarePatch,
} from '@geo-copilot/artifact-gen'
import { generatePromptUniverse } from '@geo-copilot/somv-engine'
import type { CrawlResult, GEOScore, Finding } from '@geo-copilot/core'

interface CachedAudit {
  crawlResult: CrawlResult
  score: {
    total: number
    grade: string
    pillars: Record<string, { score: number; grade: string; summary: string }>
    findings: Finding[]
  }
  timestamp: number
}

// In-memory cache to allow fast subsequent operations on audited URLs
const auditCache = new Map<string, CachedAudit>()

async function getOrRunAudit(url: string): Promise<CachedAudit> {
  const cached = auditCache.get(url)
  if (cached && Date.now() - cached.timestamp < 10 * 60 * 1000) {
    return cached
  }

  const crawlResult = await crawlUrl(url, {
    timeout: 30000,
    fetchHydrated: true,
    testMarkdownNegotiation: true,
  })

  const scoringEngine = new GEOScoringEngine()
  const score = scoringEngine.score({ crawlResult })
  const result: CachedAudit = {
    crawlResult,
    score: {
      total: score.total,
      grade: score.grade,
      pillars: score.pillars as unknown as Record<string, { score: number; grade: string; summary: string }>,
      findings: score.findings,
    },
    timestamp: Date.now(),
  }

  auditCache.set(url, result)
  return result
}

const server = new McpServer({
  name: 'geo-copilot',
  version: '0.1.0',
})

// ================================================================
// Tool: geo_audit_url
// ================================================================
server.registerTool(
  'geo_audit_url',
  {
    description:
      'Run a local GEO (Generative Engine Optimization) audit on a URL. Crawls with simulated AI bot user-agents and returns a 0-100 score across 5 pillars (Crawler Layer, Knowledge Graph, Information Gain, BLUF Architecture, SoMV).',
    inputSchema: z.object({
      url: z.string().url().describe('The URL to audit'),
    }),
  },
  async ({ url }) => {
    try {
      const { score } = await getOrRunAudit(url)

      const lines = [
        `# GEO Audit Scorecard: ${url}`,
        `**Total GEO Score**: ${score.total}/100 (${score.grade})`,
        ``,
        `## 5-Pillar Breakdown`,
        `- **Crawler Layer**: ${score.pillars.crawler_layer?.score ?? 0}/20 (${score.pillars.crawler_layer?.grade ?? 'F'}) — ${score.pillars.crawler_layer?.summary ?? ''}`,
        `- **Knowledge Graph**: ${score.pillars.knowledge_graph?.score ?? 0}/20 (${score.pillars.knowledge_graph?.grade ?? 'F'}) — ${score.pillars.knowledge_graph?.summary ?? ''}`,
        `- **Information Gain (ΔI)**: ${score.pillars.information_gain?.score ?? 0}/20 (${score.pillars.information_gain?.grade ?? 'F'}) — ${score.pillars.information_gain?.summary ?? ''}`,
        `- **BLUF Architecture**: ${score.pillars.bluf_architecture?.score ?? 0}/20 (${score.pillars.bluf_architecture?.grade ?? 'F'}) — ${score.pillars.bluf_architecture?.summary ?? ''}`,
        `- **Share of Model Voice (SoMV)**: ${score.pillars.somv?.score ?? 0}/20 (${score.pillars.somv?.grade ?? 'F'}) — ${score.pillars.somv?.summary ?? ''}`,
        ``,
        `## Top Actionable Findings (${score.findings.length} total)`,
        ...score.findings.slice(0, 8).map(
          (f) => `### [${f.severity.toUpperCase()}] ${f.title}\n${f.description}\n**Recommendation**: ${f.recommendation}\n`
        ),
      ]

      return { content: [{ type: 'text', text: lines.join('\n') }] }
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Audit error: ${err instanceof Error ? err.message : String(err)}` }],
      }
    }
  }
)

// ================================================================
// Tool: geo_list_findings
// ================================================================
server.registerTool(
  'geo_list_findings',
  {
    description: 'List findings for an audited URL, optionally filtered by pillar and minimum severity.',
    inputSchema: z.object({
      url: z.string().url().describe('The audited URL'),
      pillar: z
        .enum(['crawler_layer', 'knowledge_graph', 'information_gain', 'bluf_architecture', 'somv'])
        .optional()
        .describe('Filter by pillar'),
      severity: z
        .enum(['critical', 'high', 'medium', 'low', 'info'])
        .optional()
        .describe('Minimum severity filter'),
    }),
  },
  async ({ url, pillar, severity }) => {
    try {
      const { score } = await getOrRunAudit(url)
      let findings = score.findings

      if (pillar) findings = findings.filter((f) => f.pillar === pillar)
      if (severity) {
        const order = ['info', 'low', 'medium', 'high', 'critical']
        const minIdx = order.indexOf(severity)
        findings = findings.filter((f) => order.indexOf(f.severity) >= minIdx)
      }

      if (findings.length === 0) {
        return { content: [{ type: 'text', text: `No findings matching the specified criteria for ${url}.` }] }
      }

      const formatted = findings
        .map(
          (f) =>
            `[${f.severity.toUpperCase()}] [${f.pillar}] ${f.title}\n  ${f.description}\n  Fix: ${f.recommendation}`
        )
        .join('\n\n')

      return { content: [{ type: 'text', text: formatted }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error retrieving findings: ${err instanceof Error ? err.message : String(err)}` }] }
    }
  }
)

// ================================================================
// Tool: geo_generate_artifact
// ================================================================
server.registerTool(
  'geo_generate_artifact',
  {
    description:
      'Generate deterministic AI visibility artifacts (llms.txt, JSON-LD @graph, Next.js robots.ts, markdown middleware).',
    inputSchema: z.object({
      url: z.string().url().describe('The target URL'),
      type: z
        .enum(['llms_txt', 'llms_full_txt', 'jsonld_graph', 'robots_ts', 'middleware_patch'])
        .describe('Artifact type to generate'),
    }),
  },
  async ({ url, type }) => {
    try {
      const { crawlResult } = await getOrRunAudit(url)

      let text = ''
      switch (type) {
        case 'llms_txt':
        case 'llms_full_txt':
          text = generateLlmsTxtFromCrawl(crawlResult)
          break
        case 'jsonld_graph':
          text = JSON.stringify(generateJsonLdGraphFromCrawl(crawlResult), null, 2)
          break
        case 'robots_ts':
          text = generateRobotsTs({ siteUrl: url })
          break
        case 'middleware_patch':
          text = generateMarkdownMiddlewarePatch()
          break
      }

      return { content: [{ type: 'text', text }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Artifact generation error: ${err instanceof Error ? err.message : String(err)}` }] }
    }
  }
)

// ================================================================
// Tool: geo_create_mutation_plan
// ================================================================
server.registerTool(
  'geo_create_mutation_plan',
  {
    description:
      'Create a safety-classified mutation plan (Class A/B/C) based on audit findings from a URL.',
    inputSchema: z.object({
      url: z.string().url().describe('The target URL'),
    }),
  },
  async ({ url }) => {
    try {
      const { crawlResult, score } = await getOrRunAudit(url)

      const items: Array<{ path: string; mutationClass: string; action: string }> = []

      if (!crawlResult.llmsTxt) {
        items.push({
          path: 'public/llms.txt',
          mutationClass: 'Class B (Reversible Content)',
          action: 'Create /llms.txt manifest following llmstxt.org specification',
        })
      }

      const hasJsonLd =
        crawlResult.hydratedHtml?.includes('application/ld+json') ||
        crawlResult.ssrHtml?.includes('application/ld+json')
      if (!hasJsonLd) {
        items.push({
          path: 'app/layout.tsx',
          mutationClass: 'Class B (Reversible Content)',
          action: 'Embed structured JSON-LD @graph schema (Organization, WebSite, SoftwareApplication)',
        })
      }

      if (!crawlResult.robotsTxt) {
        items.push({
          path: 'app/robots.ts',
          mutationClass: 'Class C (Routing & Layout)',
          action: 'Implement Next.js robots.ts route explicitly allowing AI search crawlers',
        })
      }

      if (!crawlResult.markdownNegotiationSupported) {
        items.push({
          path: 'middleware.ts',
          mutationClass: 'Class C (Routing & Layout)',
          action: 'Add markdown content-negotiation middleware for text/markdown headers',
        })
      }

      const planLines = [
        `# Mutation Plan for ${url} (Current GEO Score: ${score.total}/100)`,
        `Proposed Actions (${items.length}):`,
        ``,
        ...items.map((item, idx) => `${idx + 1}. **${item.path}** [${item.mutationClass}]\n   Action: ${item.action}`),
      ]

      return { content: [{ type: 'text', text: planLines.join('\n') }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Mutation plan error: ${err instanceof Error ? err.message : String(err)}` }] }
    }
  }
)

// ================================================================
// Tool: geo_apply_mutation
// ================================================================
server.registerTool(
  'geo_apply_mutation',
  {
    description: 'Output the exact source code artifact content ready to be applied to a target project.',
    inputSchema: z.object({
      url: z.string().url().describe('The target URL'),
      artifactType: z
        .enum(['llms_txt', 'jsonld_graph', 'robots_ts', 'middleware_patch'])
        .describe('Artifact to output'),
    }),
  },
  async ({ url, artifactType }) => {
    try {
      const { crawlResult } = await getOrRunAudit(url)

      let code = ''
      switch (artifactType) {
        case 'llms_txt':
          code = generateLlmsTxtFromCrawl(crawlResult)
          break
        case 'jsonld_graph':
          code = JSON.stringify(generateJsonLdGraphFromCrawl(crawlResult), null, 2)
          break
        case 'robots_ts':
          code = generateRobotsTs({ siteUrl: url })
          break
        case 'middleware_patch':
          code = generateMarkdownMiddlewarePatch()
          break
      }

      return {
        content: [
          {
            type: 'text',
            text: `// ================================================================\n// Artifact: ${artifactType} for ${url}\n// ================================================================\n\n${code}`,
          },
        ],
      }
    } catch (err) {
      return { content: [{ type: 'text', text: `Apply error: ${err instanceof Error ? err.message : String(err)}` }] }
    }
  }
)

// ================================================================
// Tool: geo_somv_score
// ================================================================
server.registerTool(
  'geo_somv_score',
  {
    description:
      'Generate a 4-intent synthetic query prompt universe to probe and score Share of Model Voice (SoMV).',
    inputSchema: z.object({
      brandName: z.string().describe('Brand or product name to evaluate'),
    }),
  },
  async ({ brandName }) => {
    try {
      const prompts = generatePromptUniverse(brandName)

      const lines = [
        `# Share of Model Voice (SoMV) Benchmark Universe: ${brandName}`,
        `Generated ${prompts.length} benchmark prompts across 4 intent categories:`,
        ``,
        ...prompts.map(
          (p, i) => `**Prompt ${i + 1}** [Intent: ${p.intent}, Weight: ${p.targetWeight}]:\n> "${p.prompt}"\n`
        ),
        `## Classification Scoring Standard`,
        `- **Recommendation (1.0)**: Brand explicitly recommended as top choice`,
        `- **Citation (0.7)**: Brand cited with authoritative URL or reference`,
        `- **Mention (0.4)**: Brand listed among competitors or alternatives`,
        `- **None (0.0)**: Brand not cited or recognized in response`,
      ]

      return { content: [{ type: 'text', text: lines.join('\n') }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `SoMV error: ${err instanceof Error ? err.message : String(err)}` }] }
    }
  }
)

// Start stdio transport
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write('GEO-Copilot Open-Source MCP Server running on stdio\n')
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`)
  process.exit(1)
})

