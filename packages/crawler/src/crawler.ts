import { chromium } from 'playwright'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const robotsParser = require('robots-parser') as (url: string, content: string) => { isAllowed(url: string, ua?: string): boolean | undefined }
import type {
  CrawlResult,
  RobotsRule,
  CrawlerTransport,
  CrawlerProxyConfig,
} from '@geo-copilot/core'
import { AI_BOT_USER_AGENTS } from '@geo-copilot/core'

// ============================================================
// Types
// ============================================================

export interface CrawlerOptions {
  /**
   * Maximum time to wait for a page to load, in milliseconds.
   * Default: 30000
   */
  timeout?: number
  /**
   * Which bot UA to simulate when fetching the target URL.
   * Default: 'OAI-SearchBot' (representative AI search crawler)
   *
   * IMPORTANT: Never use bot UAs against third-party Cloudflare-protected
   * sites. Only use against customer's own staging environment with WAF
   * bypass configured for the audit subnet.
   */
  simulateBotUA?: string
  /**
   * Whether to perform a second (hydrated) fetch using a real browser UA
   * to capture client-side rendered content.
   * Default: true
   */
  fetchHydrated?: boolean
  /**
   * Whether to test Accept: text/markdown content negotiation.
   * Default: true
   */
  testMarkdownNegotiation?: boolean
  /**
   * Optional pluggable transport for proxy rotation, residential IP routing,
   * or custom network handling.
   * Default: DirectCrawlerTransport (local IP / standard environment proxy)
   */
  transport?: CrawlerTransport
}

export class DirectCrawlerTransport implements CrawlerTransport {
  readonly name = 'direct'

  async getProxyConfig(_targetUrl: string): Promise<CrawlerProxyConfig | null> {
    const proxyServer = process.env.HTTP_PROXY || process.env.HTTPS_PROXY
    if (!proxyServer) return null

    const config: CrawlerProxyConfig = { server: proxyServer }
    if (process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD) {
      config.username = process.env.PROXY_USERNAME
      config.password = process.env.PROXY_PASSWORD
    }
    return config
  }

  async fetchAuxiliary(
    url: string,
    headers?: Record<string, string>
  ): Promise<{ status: number; text: string; headers: Record<string, string> }> {
    const res = await fetch(url, {
      headers: headers ?? {},
      signal: AbortSignal.timeout(10_000),
    })
    const text = await res.text()
    const responseHeaders: Record<string, string> = {}
    res.headers.forEach((v, k) => {
      responseHeaders[k] = v
    })
    return { status: res.status, text, headers: responseHeaders }
  }
}

const REAL_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'


// ============================================================
// Main Crawler
// ============================================================

export function validateTargetUrl(rawUrl: string): URL {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new Error(`Invalid URL format: ${rawUrl}`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Forbidden protocol "${parsed.protocol}". Only HTTP and HTTPS protocols are permitted.`)
  }

  const hostname = parsed.hostname.toLowerCase()
  const blockedHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0', '169.254.169.254']
  if (blockedHosts.includes(hostname)) {
    throw new Error(`Access to private or local network address "${hostname}" is restricted.`)
  }

  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4Match) {
    const a = Number(ipv4Match[1])
    const b = Number(ipv4Match[2])
    if (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a === 0
    ) {
      throw new Error(`Access to private IP range "${hostname}" is restricted.`)
    }
  }

  return parsed
}

export class GEOCrawler {
  private options: Required<CrawlerOptions>
  private transport: CrawlerTransport

  constructor(options: CrawlerOptions = {}) {
    this.transport = options.transport ?? new DirectCrawlerTransport()
    this.options = {
      timeout: options.timeout ?? 30_000,
      simulateBotUA: options.simulateBotUA ?? 'OAI-SearchBot',
      fetchHydrated: options.fetchHydrated ?? true,
      testMarkdownNegotiation: options.testMarkdownNegotiation ?? true,
      transport: this.transport,
    }
  }

  async crawl(url: string): Promise<CrawlResult> {
    const startTime = Date.now()
    let browser = null

    try {
      validateTargetUrl(url)

      const proxyConfig = await this.transport.getProxyConfig?.(url)
      const launchOptions: Parameters<typeof chromium.launch>[0] = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
        ],
      }

      if (proxyConfig?.server) {
        launchOptions.proxy = {
          server: proxyConfig.server,
          username: proxyConfig.username,
          password: proxyConfig.password,
        }
      }

      browser = await chromium.launch(launchOptions)

      const [ssrResult, hydratedResult, auxResults] = await Promise.allSettled([
        this.fetchSSR(browser, url),
        this.options.fetchHydrated ? this.fetchHydrated(browser, url) : Promise.resolve(null),
        this.fetchAuxResources(browser, url),
      ])

      const ssrData = ssrResult.status === 'fulfilled' ? ssrResult.value : null
      const hydratedData = hydratedResult.status === 'fulfilled' ? hydratedResult.value : null
      const auxData = auxResults.status === 'fulfilled' ? auxResults.value : null

      // Test Markdown negotiation (lightweight fetch, not browser)
      const markdownResult = this.options.testMarkdownNegotiation
        ? await this.testMarkdownNegotiation(url)
        : { supported: false, content: null }

      // Parse robots.txt
      const robotsTxt = auxData?.robotsTxt ?? null
      const robotsRules = robotsTxt ? this.parseRobotsTxt(url, robotsTxt) : []

      let crawlError: string | null = null
      if (ssrResult.status === 'rejected') {
        const reason = ssrResult.reason
        crawlError = reason instanceof Error ? reason.message : String(reason)
      } else if (this.options.fetchHydrated && hydratedResult.status === 'rejected' && !ssrData?.html) {
        const reason = hydratedResult.reason
        crawlError = reason instanceof Error ? reason.message : String(reason)
      }

      return {
        url,
        crawledAt: new Date(),
        durationMs: Date.now() - startTime,
        ssrHtml: ssrData?.html ?? null,
        hydratedHtml: hydratedData?.html ?? null,
        robotsTxt,
        robotsRules,
        sitemapUrl: auxData?.sitemapUrl ?? null,
        sitemapXml: auxData?.sitemapXml ?? null,
        llmsTxt: auxData?.llmsTxt ?? null,
        llmsFullTxt: auxData?.llmsFullTxt ?? null,
        markdownNegotiationSupported: markdownResult.supported,
        markdownContent: markdownResult.content,
        statusCode: ssrData?.statusCode ?? 0,
        headers: ssrData?.headers ?? {},
        error: crawlError,
      }
    } catch (err) {
      return {
        url,
        crawledAt: new Date(),
        durationMs: Date.now() - startTime,
        ssrHtml: null,
        hydratedHtml: null,
        robotsTxt: null,
        robotsRules: [],
        sitemapUrl: null,
        sitemapXml: null,
        llmsTxt: null,
        llmsFullTxt: null,
        markdownNegotiationSupported: false,
        markdownContent: null,
        statusCode: 0,
        headers: {},
        error: err instanceof Error ? err.message : String(err),
      }
    } finally {
      if (browser) await browser.close()
    }
  }

  // ----------------------------------------------------------------
  // SSR fetch: uses the bot UA to see what the AI crawler sees
  // ----------------------------------------------------------------
  private async fetchSSR(
    browser: Awaited<ReturnType<typeof chromium.launch>>,
    url: string
  ): Promise<{ html: string; statusCode: number; headers: Record<string, string> }> {
    const context = await browser.newContext({
      userAgent: this.options.simulateBotUA,
      javaScriptEnabled: false, // SSR: no JS execution
      extraHTTPHeaders: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    })

    try {
      const page = await context.newPage()
      let statusCode = 200
      const responseHeaders: Record<string, string> = {}

      page.on('response', (response) => {
        if (response.url() === url || response.url() === `${url}/`) {
          statusCode = response.status()
          const headers = response.headers()
          Object.assign(responseHeaders, headers)
        }
      })

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.options.timeout })
      const html = await page.content()

      return { html, statusCode, headers: responseHeaders }
    } finally {
      await context.close()
    }
  }

  // ----------------------------------------------------------------
  // Hydrated fetch: uses a real browser UA + JS enabled
  // ----------------------------------------------------------------
  private async fetchHydrated(
    browser: Awaited<ReturnType<typeof chromium.launch>>,
    url: string
  ): Promise<{ html: string }> {
    const context = await browser.newContext({
      userAgent: REAL_BROWSER_UA,
      javaScriptEnabled: true,
    })

    try {
      const page = await context.newPage()
      await page.goto(url, { waitUntil: 'networkidle', timeout: this.options.timeout })
      const html = await page.content()
      return { html }
    } finally {
      await context.close()
    }
  }

  // ----------------------------------------------------------------
  // Auxiliary resources: robots.txt, sitemap, llms.txt, llms-full.txt
  // ----------------------------------------------------------------
  private async fetchAuxResources(
    browser: Awaited<ReturnType<typeof chromium.launch>>,
    url: string
  ): Promise<{
    robotsTxt: string | null
    sitemapUrl: string | null
    sitemapXml: string | null
    llmsTxt: string | null
    llmsFullTxt: string | null
  }> {
    const base = new URL(url).origin
    const context = await browser.newContext({ userAgent: this.options.simulateBotUA })

    try {
      const fetchText = async (path: string): Promise<string | null> => {
        try {
          const page = await context.newPage()
          const response = await page.goto(`${base}${path}`, {
            timeout: 10_000,
            waitUntil: 'domcontentloaded',
          })
          if (!response || response.status() >= 400) {
            await page.close()
            return null
          }
          const text = await page.innerText('body').catch(() => '')
          await page.close()
          return text || null
        } catch {
          return null
        }
      }

      const [robotsTxt, sitemapXml, llmsTxt, llmsFullTxt] = await Promise.all([
        fetchText('/robots.txt'),
        fetchText('/sitemap.xml'),
        fetchText('/llms.txt'),
        fetchText('/llms-full.txt'),
      ])

      // Extract sitemap URL from robots.txt if present
      let sitemapUrl: string | null = null
      if (robotsTxt) {
        const sitemapMatch = robotsTxt.match(/^Sitemap:\s*(.+)$/im)
        if (sitemapMatch) sitemapUrl = sitemapMatch[1].trim()
      }
      if (!sitemapUrl && sitemapXml) {
        sitemapUrl = `${base}/sitemap.xml`
      }

      return { robotsTxt, sitemapUrl, sitemapXml, llmsTxt, llmsFullTxt }
    } finally {
      await context.close()
    }
  }

  // ----------------------------------------------------------------
  // Markdown content negotiation test
  // ----------------------------------------------------------------
  private async testMarkdownNegotiation(
    url: string
  ): Promise<{ supported: boolean; content: string | null }> {
    try {
      // Use fetch (not browser) — lightweight header test
      const response = await fetch(url, {
        headers: {
          Accept: 'text/markdown, text/plain;q=0.9, */*;q=0.8',
          'User-Agent': this.options.simulateBotUA,
        },
        signal: AbortSignal.timeout(10_000),
      })

      const contentType = response.headers.get('content-type') ?? ''
      const supported =
        contentType.includes('text/markdown') || contentType.includes('text/plain')
      const content = supported ? await response.text() : null

      return { supported, content }
    } catch {
      return { supported: false, content: null }
    }
  }

  // ----------------------------------------------------------------
  // Parse robots.txt into structured per-bot rules
  // ----------------------------------------------------------------
  private parseRobotsTxt(siteUrl: string, robotsTxtContent: string): RobotsRule[] {
    const rules: RobotsRule[] = []
    const knownUAs = [
      ...AI_BOT_USER_AGENTS.map((b) => b.ua),
      '*',
      'Googlebot',
      'GPTBot',
      'ClaudeBot',
    ]

    for (const ua of knownUAs) {
      const parser = robotsParser(siteUrl, robotsTxtContent)
      // Get allow/disallow by checking key paths for this UA
      const testPaths = ['/', '/docs', '/blog', '/api', '/sitemap.xml', '/llms.txt', '/llms-full.txt']
      const allowed: string[] = []
      const disallowed: string[] = []

      for (const path of testPaths) {
        if (parser.isAllowed(new URL(path, siteUrl).href, ua)) {
          allowed.push(path)
        } else {
          disallowed.push(path)
        }
      }

      rules.push({ userAgent: ua, allow: allowed, disallow: disallowed })
    }

    return rules
  }
}

// ============================================================
// Convenience export
// ============================================================

export async function crawlUrl(url: string, options?: CrawlerOptions): Promise<CrawlResult> {
  const crawler = new GEOCrawler(options)
  return crawler.crawl(url)
}
