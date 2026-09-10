/**
 * Generates a Next.js robots.ts route with GEO-optimal configuration:
 * - Allow AI search engine crawlers (OAI-SearchBot, PerplexityBot, Claude-Web, Bingbot)
 * - Block pretraining scrapers (GPTBot, ClaudeBot, Google-Extended, Meta-ExternalAgent)
 * - Expose Sitemap directive
 */
export function generateRobotsTs(options: {
  siteUrl: string
  allowAllByDefault?: boolean
  additionalAllowedBots?: string[]
  additionalBlockedBots?: string[]
}): string {
  const { siteUrl, allowAllByDefault = true, additionalAllowedBots = [], additionalBlockedBots = [] } = options

  const allowedBots = [
    'OAI-SearchBot',
    'ChatGPT-User',
    'PerplexityBot',
    'Perplexity-User',
    'Claude-Web',
    'Bingbot',
    'Googlebot',
    ...additionalAllowedBots,
  ]

  const blockedBots = [
    'GPTBot',
    'ClaudeBot',
    'Anthropic-AI',
    'Google-Extended',
    'Meta-ExternalAgent',
    'Meta-ExternalFetcher',
    'Applebot-Extended',
    ...additionalBlockedBots,
  ]

  const allowRules = allowedBots
    .map((ua) => `      { userAgent: '${ua}', allow: '/' },`)
    .join('\n')

  const blockRules = blockedBots
    .map((ua) => `      { userAgent: '${ua}', disallow: '/' },`)
    .join('\n')

  const defaultRule = allowAllByDefault
    ? `      { userAgent: '*', allow: '/' },`
    : `      { userAgent: '*', disallow: '/' },`

  return `import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? '${siteUrl}'
  return {
    rules: [
      // Allow AI search / answer engine crawlers
${allowRules}
      // Block pretraining scrapers (search is allowed, training is not)
${blockRules}
      // Default rule
${defaultRule}
    ],
    sitemap: \`\${baseUrl}/sitemap.xml\`,
  }
}
`
}

/**
 * Generates a plain robots.txt string (for static sites)
 */
export function generateRobotsTxt(options: {
  siteUrl: string
  additionalAllowedBots?: string[]
  additionalBlockedBots?: string[]
}): string {
  const allowedBots = [
    'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Perplexity-User',
    'Claude-Web', 'Bingbot', 'Googlebot',
    ...(options.additionalAllowedBots ?? []),
  ]
  const blockedBots = [
    'GPTBot', 'ClaudeBot', 'Anthropic-AI', 'Google-Extended',
    'Meta-ExternalAgent', 'Meta-ExternalFetcher', 'Applebot-Extended',
    ...(options.additionalBlockedBots ?? []),
  ]

  const lines: string[] = [
    '# Allow AI search engines and answer engine crawlers',
  ]

  for (const ua of allowedBots) {
    lines.push(`User-agent: ${ua}`, 'Allow: /', '')
  }

  lines.push('# Block pretraining scrapers')
  for (const ua of blockedBots) {
    lines.push(`User-agent: ${ua}`, 'Disallow: /', '')
  }

  lines.push('# Default', 'User-agent: *', 'Allow: /', '', `Sitemap: ${options.siteUrl}/sitemap.xml`)

  return lines.join('\n')
}
