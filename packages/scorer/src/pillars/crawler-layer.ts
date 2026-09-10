import type { CrawlResult } from '@geo-copilot/core'
import type { PillarResult } from '../types.js'

/**
 * Crawler Layer Scorer (max 20 points)
 *
 * Points breakdown:
 * - /llms.txt present + valid H1:         +5
 * - /llms-full.txt present:               +2
 * - AI search bots allowed in robots.txt: +5 (1 per major engine up to 5)
 * - Pretraining bots blocked:             +2
 * - SSR HTML returned (non-empty):        +3
 * - Markdown negotiation supported:       +3
 */
export function scoreCrawlerLayer(crawl: CrawlResult): PillarResult {
  let score = 0
  const findings: PillarResult['findings'] = []

  // 1. /llms.txt presence + validity (max 5)
  if (crawl.llmsTxt) {
    if (crawl.llmsTxt.match(/^#\s+.+/m)) {
      score += 5
    } else {
      score += 2
      findings.push({
        pillar: 'crawler_layer',
        severity: 'medium',
        title: '/llms.txt missing H1 header',
        description: 'The /llms.txt file exists but does not start with a valid H1 (# Title) as required by the llmstxt.org spec.',
        recommendation: 'Add `# Your Product Name` as the first line of /llms.txt.',
        location: { type: 'url', value: `${new URL(crawl.url).origin}/llms.txt` },
        autoFixable: true,
        estimatedImpact: 3,
      })
    }
  } else {
    findings.push({
      pillar: 'crawler_layer',
      severity: 'critical',
      title: '/llms.txt not found',
      description: 'No /llms.txt file was found at the root of this domain. AI answer engines use this file to understand and index your product.',
      recommendation: 'Create /llms.txt following the llmstxt.org spec. GEOAgent can generate this automatically.',
      location: { type: 'url', value: `${new URL(crawl.url).origin}/llms.txt` },
      autoFixable: true,
      estimatedImpact: 5,
    })
  }

  // 2. /llms-full.txt (max 2)
  if (crawl.llmsFullTxt) {
    score += 2
  } else {
    findings.push({
      pillar: 'crawler_layer',
      severity: 'medium',
      title: '/llms-full.txt not found',
      description: '/llms-full.txt provides the full documentation content for AI engines with large context windows.',
      recommendation: 'Create /llms-full.txt with concatenated, clean Markdown content of your docs.',
      location: { type: 'url', value: `${new URL(crawl.url).origin}/llms-full.txt` },
      autoFixable: true,
      estimatedImpact: 2,
    })
  }

  // 3. AI search bots allowed in robots.txt (max 5)
  const searchBotUAs = [
    'OAI-SearchBot',
    'PerplexityBot',
    'Claude-Web',
    'Bingbot',
    'Googlebot',
  ]
  let allowedBots = 0

  for (const ua of searchBotUAs) {
    const rule = crawl.robotsRules.find((r) => r.userAgent === ua)
    if (!rule || rule.disallow.includes('/')) {
      findings.push({
        pillar: 'crawler_layer',
        severity: 'high',
        title: `${ua} may be blocked in robots.txt`,
        description: `The AI search crawler ${ua} appears to be blocked or restricted in your robots.txt. This prevents the engine from indexing your content.`,
        recommendation: `Add \`User-agent: ${ua}\nAllow: /\` to your robots.txt.`,
        location: { type: 'url', value: `${new URL(crawl.url).origin}/robots.txt` },
        autoFixable: true,
        estimatedImpact: 2,
      })
    } else {
      allowedBots++
    }
  }
  score += Math.min(allowedBots, 5)

  // 4. Pretraining bots blocked (max 2)
  const trainingBotUAs = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Meta-ExternalAgent']
  let blockedTrainingBots = 0
  for (const ua of trainingBotUAs) {
    const rule = crawl.robotsRules.find((r) => r.userAgent === ua)
    if (rule && rule.disallow.includes('/')) {
      blockedTrainingBots++
    }
  }
  // Award 1 point if at least 1 training bot is blocked, 2 if 3+
  if (blockedTrainingBots >= 3) score += 2
  else if (blockedTrainingBots >= 1) score += 1
  else {
    findings.push({
      pillar: 'crawler_layer',
      severity: 'low',
      title: 'Pretraining bots not explicitly blocked',
      description: 'Training crawlers (GPTBot, ClaudeBot, Google-Extended) are not blocked. This allows AI companies to use your content for model training without compensation.',
      recommendation: 'Consider blocking pretraining bots while allowing search engine crawlers. GEOAgent can generate the correct robots.txt pattern.',
      location: { type: 'url', value: `${new URL(crawl.url).origin}/robots.txt` },
      autoFixable: true,
      estimatedImpact: 1,
    })
  }

  // 5. SSR HTML (max 3)
  if (crawl.ssrHtml && crawl.ssrHtml.length > 1000) {
    score += 3
  } else if (crawl.ssrHtml && crawl.ssrHtml.length > 200) {
    score += 1
    findings.push({
      pillar: 'crawler_layer',
      severity: 'high',
      title: 'Minimal SSR HTML detected',
      description: 'The page returns very little HTML without JavaScript. AI crawlers that do not execute JS will see an empty or skeletal page.',
      recommendation: 'Ensure all key content is server-rendered (SSR) or statically generated (SSG). For Next.js, avoid "use client" on pages that contain primary content.',
      location: { type: 'url', value: crawl.url },
      autoFixable: false,
      estimatedImpact: 3,
    })
  } else {
    findings.push({
      pillar: 'crawler_layer',
      severity: 'critical',
      title: 'No SSR HTML — client-only rendering detected',
      description: 'This page appears to be client-side rendered only. AI search engine crawlers cannot execute JavaScript and will see an empty page.',
      recommendation: 'Implement SSR or SSG using Next.js App Router server components, or pre-render critical content.',
      location: { type: 'url', value: crawl.url },
      autoFixable: false,
      estimatedImpact: 5,
    })
  }

  // 6. Markdown negotiation (max 3)
  if (crawl.markdownNegotiationSupported) {
    score += 3
  } else {
    findings.push({
      pillar: 'crawler_layer',
      severity: 'medium',
      title: 'Markdown content negotiation not supported',
      description: 'The server does not respond with Markdown when Accept: text/markdown is sent. Some AI engines prefer Markdown-formatted content for cleaner extraction.',
      recommendation: 'Add an edge middleware that serves Markdown alternatives for documentation pages when Accept: text/markdown is requested.',
      location: { type: 'url', value: crawl.url },
      autoFixable: true,
      estimatedImpact: 2,
    })
  }

  const clampedScore = Math.min(Math.max(score, 0), 20)
  return {
    score: clampedScore,
    summary: buildCrawlerSummary(clampedScore),
    findings,
  }
}

function buildCrawlerSummary(score: number): string {
  if (score >= 18) return 'Excellent crawler access — all major AI bots can reach and index your content.'
  if (score >= 14) return 'Good crawler access with minor gaps. llms.txt and bot rules are mostly correct.'
  if (score >= 10) return 'Moderate crawler access. Missing llms.txt or key AI bot allowances.'
  if (score >= 6) return 'Poor crawler access. AI engines likely cannot index your content correctly.'
  return 'Critical crawler issues. AI search engines are blocked or see no content.'
}
