import type { CrawlResult } from '@geo-copilot/core'
import { extractSiteMetadata } from './llms-txt.js'

export interface JsonLdGraphOptions {
  siteUrl: string
  siteName: string
  orgName: string
  description: string
  softwareVersion?: string
  sameAs?: {
    wikidata?: string
    crunchbase?: string
    github?: string
    twitter?: string
    linkedin?: string
    productHunt?: string
  }
  faqItems?: Array<{ question: string; answer: string }>
  docPages?: Array<{ url: string; headline: string; description: string }>
  inLanguage?: string
  logoUrl?: string
  foundingDate?: string
}

/**
 * Generates a complete JSON-LD @graph directly from a live CrawlResult.
 */
export function generateJsonLdGraphFromCrawl(crawl: CrawlResult): object {
  const meta = extractSiteMetadata(crawl)
  const docPages = meta.discoveredLinks
    .filter((l) => l.category === 'Documentation & API' || l.category === 'Articles & Guides')
    .slice(0, 5)
    .map((l) => ({
      url: l.url,
      headline: l.title,
      description: `Official ${l.title} documentation and guide for ${meta.siteName}.`,
    }))

  return generateJsonLdGraph({
    siteUrl: crawl.url,
    siteName: meta.siteName,
    orgName: meta.siteName,
    description: meta.description || `${meta.siteName} official web application and services.`,
    logoUrl: meta.logoUrl,
    inLanguage: meta.inLanguage,
    docPages: docPages.length > 0 ? docPages : undefined,
  })
}

/**
 * Generates a complete JSON-LD @graph following GEO best practices.
 * Includes Organization, WebSite, SoftwareApplication, and optional
 * TechArticle + FAQPage nodes, all linked via @id references.
 */
export function generateJsonLdGraph(options: JsonLdGraphOptions): object {
  const base = options.siteUrl.replace(/\/$/, '')
  const sameAsUrls = [
    options.sameAs?.wikidata,
    options.sameAs?.crunchbase,
    options.sameAs?.github,
    options.sameAs?.twitter,
    options.sameAs?.linkedin,
    options.sameAs?.productHunt,
  ].filter(Boolean) as string[]

  const graph: object[] = [
    // Organization
    {
      '@type': 'Organization',
      '@id': `${base}/#organization`,
      name: options.orgName,
      url: base,
      ...(options.logoUrl && {
        logo: {
          '@type': 'ImageObject',
          url: options.logoUrl,
        },
      }),
      ...(options.foundingDate && { foundingDate: options.foundingDate }),
      ...(sameAsUrls.length > 0 && { sameAs: sameAsUrls }),
    },

    // WebSite
    {
      '@type': 'WebSite',
      '@id': `${base}/#website`,
      url: base,
      name: options.siteName,
      description: options.description,
      publisher: { '@id': `${base}/#organization` },
      inLanguage: options.inLanguage ?? 'en-US',
    },

    // SoftwareApplication
    {
      '@type': 'SoftwareApplication',
      '@id': `${base}/#software`,
      name: options.siteName,
      description: options.description,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Cloud / Linux / macOS / Windows',
      ...(options.softwareVersion && { softwareVersion: options.softwareVersion }),
      author: { '@id': `${base}/#organization` },
      isPartOf: { '@id': `${base}/#website` },
      ...(options.sameAs?.github && { sameAs: [options.sameAs.github] }),
    },
  ]

  // FAQPage
  if (options.faqItems && options.faqItems.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${base}/#faq`,
      isPartOf: { '@id': `${base}/#website` },
      mainEntity: options.faqItems.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    })
  }

  // TechArticle nodes
  if (options.docPages && options.docPages.length > 0) {
    for (const doc of options.docPages) {
      graph.push({
        '@type': 'TechArticle',
        '@id': `${doc.url}#article`,
        isPartOf: { '@id': `${base}/#website` },
        headline: doc.headline,
        description: doc.description,
        about: { '@id': `${base}/#software` },
        author: { '@id': `${base}/#organization` },
        proficiencyLevel: 'Expert',
        inLanguage: options.inLanguage ?? 'en-US',
        url: doc.url,
      })
    }
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph,
  }
}

/**
 * Generates a React/Next.js JsonLd component that outputs the @graph
 */
export function generateJsonLdComponent(schema: object, componentName = 'JsonLdGraph'): string {
  const schemaStr = JSON.stringify(schema, null, 2).replace(/</g, '\\u003c')
  return `export function ${componentName}() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(${schemaStr}),
      }}
    />
  )
}
`
}
