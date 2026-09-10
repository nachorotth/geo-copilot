import type { CrawlResult, Project } from '@geo-copilot/core'

export interface LlmsTxtOptions {
  project: Pick<Project, 'name' | 'domain'>
  siteName: string
  tagline: string
  description?: string
  sections: LlmsTxtSection[]
  optionalSections?: LlmsTxtSection[]
}

export interface LlmsTxtSection {
  title: string
  links: Array<{ title: string; url: string; description: string }>
}

export interface ExtractedSiteMetadata {
  siteName: string
  tagline: string
  description?: string
  logoUrl?: string
  inLanguage?: string
  discoveredLinks: Array<{ title: string; url: string; category: string }>
}

function cleanHtmlText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanSlugTitle(path: string): string {
  const segments = path.split('/').filter(Boolean)
  const last = segments[segments.length - 1] ?? ''
  return last
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

/**
 * Deterministically extracts site title, meta description, sitemap URLs,
 * and navigation links from a CrawlResult without external dependencies.
 */
export function extractSiteMetadata(crawl: CrawlResult): ExtractedSiteMetadata {
  const urlObj = new URL(crawl.url)
  const origin = urlObj.origin
  const hostname = urlObj.hostname

  const html = crawl.hydratedHtml || crawl.ssrHtml || ''

  // 1. Site Name
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const rawTitle = titleMatch ? cleanHtmlText(titleMatch[1] ?? '') : ''

  const ogSiteNameMatch =
    html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:site_name["']/i)
  const ogSiteName = ogSiteNameMatch ? cleanHtmlText(ogSiteNameMatch[1] ?? '') : ''

  const ogTitleMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i)
  const ogTitle = ogTitleMatch ? cleanHtmlText(ogTitleMatch[1] ?? '') : ''

  let siteName = ogSiteName || ''
  if (!siteName && rawTitle) {
    const parts = rawTitle.split(/[-|•–:]/)
    siteName = parts[0]?.trim() || ''
  }
  if (!siteName && ogTitle) {
    siteName = ogTitle.split(/[-|•–:]/)[0]?.trim() || ''
  }
  if (!siteName) {
    siteName = hostname
  }

  // 2. Tagline & Description
  const metaDescMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)
  const metaDesc = metaDescMatch ? cleanHtmlText(metaDescMatch[1] ?? '') : ''

  const ogDescMatch =
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i)
  const ogDesc = ogDescMatch ? cleanHtmlText(ogDescMatch[1] ?? '') : ''

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  const firstH1 = h1Match ? cleanHtmlText(h1Match[1] ?? '') : ''

  let tagline = firstH1 || ogTitle || rawTitle || `${siteName} Platform`
  let description =
    metaDesc || ogDesc || `${siteName} official web application and services.`

  // 3. Logo & Language
  const ogImageMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["']/i)
  const ogImage = ogImageMatch ? ogImageMatch[1]?.trim() : ''

  const faviconMatch = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']*)["']/i)
  const favicon = faviconMatch ? faviconMatch[1]?.trim() : ''
  let logoUrl = ogImage || (favicon ? new URL(favicon, origin).toString() : undefined)

  const langMatch = html.match(/<html[^>]+lang=["']([^"']*)["']/i)
  const inLanguage = langMatch ? langMatch[1]?.trim() : 'en-US'

  // 4. Collect real links from HTML and Sitemap
  const discoveredLinksMap = new Map<string, { title: string; url: string; category: string }>()

  const categorize = (href: string, title: string): string => {
    const lower = (href + ' ' + title).toLowerCase()
    if (lower.match(/doc|api|guide|spec|manual|reference|swagger|schema/))
      return 'Documentation & API'
    if (
      lower.match(
        /feature|product|capability|solution|service|tool|platform|module|app|overview/
      )
    )
      return 'Core Capabilities & Solutions'
    if (lower.match(/pricing|plan|cost|tier|subscribe|subscription/)) return 'Pricing & Plans'
    if (lower.match(/blog|news|article|post|tutorial/)) return 'Articles & Guides'
    if (lower.match(/about|contact|team|company|legal|terms|privacy|security/))
      return 'Company & Legal'
    return 'Main Navigation'
  }

  // From HTML <a> links
  const linkRegex = /<a\b[^>]*\bhref=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  let linkMatch: RegExpExecArray | null
  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const href = linkMatch[1]?.trim()
    const text = cleanHtmlText(linkMatch[2] ?? '')
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('javascript:') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:')
    )
      continue

    try {
      const fullUrl = new URL(href, origin)
      if (fullUrl.origin !== origin) continue
      if (fullUrl.pathname === '/' || fullUrl.pathname === '') continue
      if (fullUrl.pathname.match(/\.(png|jpg|jpeg|svg|css|js|ico|pdf|zip)$/i)) continue

      const cleanUrl = fullUrl.origin + fullUrl.pathname
      const title =
        text && text.length >= 2 && text.length <= 60 ? text : cleanSlugTitle(fullUrl.pathname)
      const category = categorize(cleanUrl, title)

      if (!discoveredLinksMap.has(cleanUrl) && title) {
        discoveredLinksMap.set(cleanUrl, { title, url: cleanUrl, category })
      }
    } catch {
      // Ignore invalid URLs
    }
  }

  // From Sitemap XML if available
  if (crawl.sitemapXml) {
    const sitemapMatches = crawl.sitemapXml.matchAll(/<loc>\s*(https?:\/\/[^\s<]+)\s*<\/loc>/gi)
    for (const match of sitemapMatches) {
      const sitemapUrl = match[1]?.trim()
      if (!sitemapUrl) continue
      try {
        const fullUrl = new URL(sitemapUrl)
        if (fullUrl.origin !== origin) continue
        if (fullUrl.pathname === '/' || fullUrl.pathname === '') continue
        if (fullUrl.pathname.match(/\.(png|jpg|jpeg|svg|css|js|ico|pdf|zip)$/i)) continue

        const cleanUrl = fullUrl.origin + fullUrl.pathname
        if (!discoveredLinksMap.has(cleanUrl)) {
          const title = cleanSlugTitle(fullUrl.pathname)
          const category = categorize(cleanUrl, title)
          discoveredLinksMap.set(cleanUrl, { title, url: cleanUrl, category })
        }
      } catch {
        // Ignore
      }
    }
  }

  return {
    siteName,
    tagline,
    description,
    logoUrl,
    inLanguage,
    discoveredLinks: Array.from(discoveredLinksMap.values()),
  }
}

/**
 * Generates a rich /llms.txt manifest directly from a live CrawlResult.
 */
export function generateLlmsTxtFromCrawl(crawl: CrawlResult): string {
  const meta = extractSiteMetadata(crawl)
  const urlObj = new URL(crawl.url)
  const origin = urlObj.origin

  const groups = new Map<string, Array<{ title: string; url: string; description: string }>>()

  for (const link of meta.discoveredLinks) {
    const cat = link.category
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat)!.push({
      title: link.title,
      url: link.url,
      description: `Official ${link.title} resource on ${meta.siteName}.`,
    })
  }

  const sections: LlmsTxtSection[] = []

  const priorityOrder = [
    'Core Capabilities & Solutions',
    'Documentation & API',
    'Pricing & Plans',
    'Main Navigation',
    'Articles & Guides',
    'Company & Legal',
  ]

  for (const cat of priorityOrder) {
    const items = groups.get(cat)
    if (items && items.length > 0) {
      sections.push({
        title: cat,
        links: items.slice(0, 10),
      })
      groups.delete(cat)
    }
  }

  for (const [cat, items] of groups.entries()) {
    if (items.length > 0) {
      sections.push({
        title: cat,
        links: items.slice(0, 8),
      })
    }
  }

  if (sections.length === 0) {
    sections.push({
      title: 'Platform Overview',
      links: [
        {
          title: `${meta.siteName} Home`,
          url: crawl.url,
          description: meta.description || `${meta.siteName} official platform.`,
        },
      ],
    })
  }

  return generateLlmsTxt({
    project: { name: meta.siteName, domain: urlObj.hostname },
    siteName: meta.siteName,
    tagline: meta.tagline,
    description: meta.description,
    sections,
    optionalSections: [
      {
        title: 'Full Documentation Corpus',
        links: [
          {
            title: 'Complete LLM Context Bundle',
            url: `${origin}/llms-full.txt`,
            description: `Complete concatenated documentation corpus for ${meta.siteName}.`,
          },
        ],
      },
    ],
  })
}

/**
 * Generates /llms.txt content following the llmstxt.org specification.
 * Required: single H1 header. Everything else is optional but recommended.
 */
export function generateLlmsTxt(options: LlmsTxtOptions): string {
  const lines: string[] = []

  // H1 (required per spec)
  lines.push(`# ${options.siteName}`)
  lines.push('')

  // Blockquote summary (recommended)
  lines.push(`> ${options.tagline}`)
  lines.push('')

  // Optional longer description
  if (options.description) {
    lines.push(options.description)
    lines.push('')
  }

  // Main sections
  for (const section of options.sections) {
    lines.push(`## ${section.title}`)
    for (const link of section.links) {
      lines.push(`- [${link.title}](${link.url}): ${link.description}`)
    }
    lines.push('')
  }

  // Optional section (lower priority)
  if (options.optionalSections && options.optionalSections.length > 0) {
    lines.push('## Optional')
    for (const section of options.optionalSections) {
      for (const link of section.links) {
        lines.push(`- [${link.title}](${link.url}): ${link.description}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Generates a Next.js App Router route handler for /llms.txt
 */
export function generateLlmsTxtRouteHandler(content: string): string {
  const escaped = JSON.stringify(content)
  return `import { NextResponse } from 'next/server'

export const dynamic = 'force-static'
export const revalidate = 86400 // 24 hours

export async function GET() {
  const content = ${escaped}

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
    },
  })
}
`
}

/**
 * Generates the link tag to add to <head> for llms.txt discovery
 */
export function generateLlmsTxtLinkTag(): string {
  return `<link rel="describedby" href="/llms.txt" />`
}
