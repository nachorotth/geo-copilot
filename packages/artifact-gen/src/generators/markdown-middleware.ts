/**
 * Generates a Next.js middleware.ts patch that adds Markdown content negotiation.
 * When a request has Accept: text/markdown, the middleware rewrites the request
 * to a .md version of the path (if available) or adds a header for the page to handle.
 */
export function generateMarkdownMiddlewarePatch(): string {
  return `import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Paths that support Markdown content negotiation
const MARKDOWN_SUPPORTED_PATHS = [
  /^\/docs(\/.*)?$/,
  /^\/blog(\/.*)?$/,
  /^\/changelog(\/.*)?$/,
  /^\/api-reference(\/.*)?$/,
]

export function middleware(request: NextRequest) {
  const accept = request.headers.get('accept') ?? ''
  const { pathname } = request.nextUrl

  // Markdown content negotiation
  if (
    accept.includes('text/markdown') &&
    MARKDOWN_SUPPORTED_PATHS.some((pattern) => pattern.test(pathname))
  ) {
    const mdPath = pathname.endsWith('.md') ? pathname : \`\${pathname}.md\`
    const mdUrl = request.nextUrl.clone()
    mdUrl.pathname = mdPath

    // Try to rewrite to .md version; if it 404s Next.js falls through to HTML
    const response = NextResponse.rewrite(mdUrl)
    response.headers.set('Vary', 'Accept')
    response.headers.set('Content-Type', 'text/markdown; charset=utf-8')
    return response
  }

  // Pass through all other requests
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ],
}
`
}
