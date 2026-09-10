const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const WHITE = '\x1b[37m'
const MAGENTA = '\x1b[35m'

export function printMainHelp(): void {
  console.log(`
${BOLD}${CYAN}╔═══════════════════════════════════════════════════════════════════════╗${RESET}
${BOLD}${CYAN}║${RESET}  ${BOLD}${WHITE}🧭 GEO-Copilot CLI${RESET} — Open-Source Generative Engine Optimization     ${BOLD}${CYAN}║${RESET}
${BOLD}${CYAN}╚═══════════════════════════════════════════════════════════════════════╝${RESET}

${BOLD}USAGE:${RESET}
  $ geo-copilot <command> [arguments] [options]

${BOLD}CORE COMMANDS:${RESET}
  ${GREEN}audit${RESET} <url>               Run deterministic 5-pillar GEO audit on a live website
  ${GREEN}generate${RESET} <url>            Generate production GEO artifacts (llms.txt, JSON-LD, etc.)
  ${GREEN}somv${RESET} <brand>              Generate 4-intent synthetic prompts to probe AI visibility
  ${GREEN}agent${RESET}                     Show how to pair with @GEOAgent in Cursor, Claude & IDEs
  ${GREEN}research${RESET}                  Display academic foundations & papers behind GEO

${BOLD}HELP & INFORMATION:${RESET}
  ${YELLOW}help <command>${RESET}            Detailed help for any command (${DIM}audit, generate, somv, agent, research${RESET})
  ${YELLOW}--help, -h${RESET}                Show this general help screen
  ${YELLOW}--version, -v${RESET}             Print version number

${BOLD}QUICK EXAMPLES:${RESET}
  $ geo-copilot audit https://mysite.com
  $ geo-copilot audit https://mysite.com --json -o report.json
  $ geo-copilot generate https://mysite.com --type llms_txt > public/llms.txt
  $ geo-copilot generate https://mysite.com --type jsonld
  $ geo-copilot somv "MyBrand"
  $ geo-copilot help audit
  $ geo-copilot agent
`)
}

export function printAuditHelp(): void {
  console.log(`
${BOLD}${CYAN}COMMAND: audit${RESET} — Run Deterministic 5-Pillar GEO Audit

${BOLD}DESCRIPTION:${RESET}
  Simulates AI bot crawlers (GPTBot, ClaudeBot, PerplexityBot) to crawl the
  target URL, checks SSR vs client-side hydration, inspects /llms.txt, parses
  JSON-LD schemas, evaluates BLUF information architecture, and calculates
  a 0–100 deterministic GEO Index.

${BOLD}USAGE:${RESET}
  $ geo-copilot audit <url> [options]

${BOLD}OPTIONS:${RESET}
  ${YELLOW}--format, -f <terminal|json>${RESET}   Output display format (default: terminal)
  ${YELLOW}--output, -o <filepath>${RESET}       Save full audit output to a file
  ${YELLOW}--json${RESET}                         Shortcut for '--format json'
  ${YELLOW}--help, -h${RESET}                     Show this command help

${BOLD}THE 5 EVALUATED PILLARS (20 pts each):${RESET}
  1. ${BOLD}Crawler Layer${RESET}: AI bot user-agent access, /llms.txt, SSR parity
  2. ${BOLD}Knowledge Graph${RESET}: Connected JSON-LD @graph, Wikidata sameAs, semantic tags
  3. ${BOLD}Information Gain (ΔI)${RESET}: Factual density, novel statistics, founder quotes
  4. ${BOLD}BLUF Architecture${RESET}: 40–60 word opening thesis statements under H2/H3
  5. ${BOLD}Share of Model Voice (SoMV)${RESET}: Multi-intent synthetic probe readiness

${BOLD}EXAMPLES:${RESET}
  $ geo-copilot audit https://example.com
  $ geo-copilot audit https://example.com --json
  $ geo-copilot audit https://example.com --json --output audit-report.json
`)
}

export function printGenerateHelp(): void {
  console.log(`
${BOLD}${CYAN}COMMAND: generate${RESET} — Deterministic Production Manifest Generator

${BOLD}DESCRIPTION:${RESET}
  Crawls the target live URL to extract real site metadata, titles, descriptions,
  and sitemaps, then deterministically generates production-ready GEO artifacts
  with ${GREEN}$0 AI API cost${RESET}.

${BOLD}USAGE:${RESET}
  $ geo-copilot generate <url> --type <artifact_type> [options]

${BOLD}SUPPORTED ARTIFACT TYPES (--type, -t):${RESET}
  ${GREEN}llms_txt${RESET} (or ${DIM}llms.txt${RESET})
    Generates /llms.txt manifest following the llmstxt.org specification.
    Includes H1 title, blockquote summary, and curated markdown links.
    Recommended path: ${WHITE}public/llms.txt${RESET}

  ${GREEN}jsonld${RESET} (or ${DIM}json-ld${RESET})
    Generates a linked JSON-LD @graph containing Organization, WebSite,
    and SoftwareApplication schema definitions.
    Recommended injection: ${WHITE}app/layout.tsx${RESET}

  ${GREEN}robots${RESET} (or ${DIM}robots.ts${RESET})
    Generates a Next.js App Router robots.ts configuration that explicitly
    allows AI search crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.).
    Recommended path: ${WHITE}app/robots.ts${RESET}

  ${GREEN}middleware${RESET}
    Generates Next.js edge middleware for markdown content negotiation
    (serving clean text/markdown when requested by AI agents).
    Recommended path: ${WHITE}middleware.ts${RESET}

${BOLD}OPTIONS:${RESET}
  ${YELLOW}--type, -t <type>${RESET}       Artifact type (default: llms_txt)
  ${YELLOW}--output, -o <file>${RESET}     Save artifact to a file instead of stdout
  ${YELLOW}--help, -h${RESET}              Show this command help

${BOLD}EXAMPLES:${RESET}
  $ geo-copilot generate https://mysite.com --type llms_txt > public/llms.txt
  $ geo-copilot generate https://mysite.com --type jsonld -o schema.json
  $ geo-copilot generate https://mysite.com --type robots > app/robots.ts
  $ geo-copilot generate https://mysite.com --type middleware > middleware.ts
`)
}

export function printSomvHelp(): void {
  console.log(`
${BOLD}${CYAN}COMMAND: somv${RESET} — Share of Model Voice (SoMV) Benchmark Generator

${BOLD}DESCRIPTION:${RESET}
  Generates a synthetic query benchmark universe across 4 search intent archetypes
  to evaluate brand recommendation, citation, and mention rates in LLM search.

${BOLD}USAGE:${RESET}
  $ geo-copilot somv <brand_or_product_name>

${BOLD}4 INTENT CATEGORIES EVALUATED:${RESET}
  1. ${BOLD}Category Exploration${RESET} (Weight: 0.30): "What are the leading tools for X?"
  2. ${BOLD}Direct Comparison${RESET} (Weight: 0.30): "Brand vs Competitor for Y"
  3. ${BOLD}Specific Feature Inquiry${RESET} (Weight: 0.25): "How does Brand handle Z?"
  4. ${BOLD}Troubleshooting & Technical${RESET} (Weight: 0.15): "How to resolve issue with Brand?"

${BOLD}SCORING CLASSIFICATION CRITERIA:${RESET}
  - ${GREEN}Recommendation (1.0)${RESET}: Brand explicitly recommended as top choice
  - ${GREEN}Citation (0.7)${RESET}: Brand cited with verifiable URL or authoritative reference
  - ${YELLOW}Mention (0.4)${RESET}: Brand listed among alternatives or competitors
  - ${DIM}None (0.0)${RESET}: Brand not cited or recognized

${BOLD}EXAMPLES:${RESET}
  $ geo-copilot somv "MyProduct"
  $ geo-copilot somv "ElCoyote"
`)
}

export function printAgentHelp(): void {
  console.log(`
${BOLD}${CYAN}COMMAND: agent${RESET} — Pairing with @GEOAgent

${BOLD}WHO IS @GEOAgent?${RESET}
  @GEOAgent is the open-source Generative Engine Optimization autonomous agent.
  While the CLI handles deterministic plumbing ($0 API cost scaffolding),
  ${BOLD}@GEOAgent performs the deep reasoning & content optimization${RESET}:
  - Rewriting documentation with BLUF (Bottom Line Up Front) 40–60 word thesis blocks.
  - Engineering Information Gain (ΔI) with empirical metrics and founder quotes.
  - Constructing ontological JSON-LD @graph schemas tied to Wikidata entities.
  - Iteratively testing and tuning content to win citations in Perplexity & SearchGPT.

${BOLD}PUBLIC SPECIFICATION FILE:${RESET}
  Read the complete persona, 100-point rubric, and guardrails at:
  ${WHITE}GEOAgent.md${RESET} (in the repo root)

${BOLD}HOW TO USE IN YOUR IDE:${RESET}
  ${BOLD}1. Cursor${RESET}:
     Add as ${WHITE}.cursor/rules/geo-agent.mdc${RESET} or copy into ${WHITE}.cursorrules${RESET}.
  ${BOLD}2. Claude Desktop${RESET}:
     Add the MCP server to ${WHITE}claude_desktop_config.json${RESET}, then set the system
     prompt to the contents of ${WHITE}GEOAgent.md${RESET}.
  ${BOLD}3. Antigravity & AI Coding Harnesses${RESET}:
     Call or invoke ${WHITE}@GEOAgent${RESET} directly.

${BOLD}EXAMPLE PROMPTS:${RESET}
  - "Adopt the role of @GEOAgent. Audit https://mysite.com and fix our BLUF structure."
  - "Inspect our docs and rewrite the introduction with high Information Gain (ΔI)."
  - "Build a connected JSON-LD @graph linking our Organization to Wikidata."
`)
}

export function printResearchHelp(): void {
  console.log(`
${BOLD}${CYAN}COMMAND: research${RESET} — Academic Foundations & Scientific Research

${BOLD}WHY GEO IS DIFFERENT FROM SEO:${RESET}
  Traditional SEO relies on keyword frequency and backlink counts in an inverted index.
  Modern AI search engines use a 4-stage RAG pipeline (Retrieval → Reranker → Context → Synthesis).
  Keyword stuffing actively lowers neural reranking scores.

${BOLD}KEY FOUNDATIONAL PAPERS:${RESET}
  1. ${BOLD}"GEO: Generative Engine Optimization"${RESET}
     Authors: Aggarwal et al. (Princeton University / AI2 / Georgia Tech / IIT Delhi)
     Venue: ACM SIGKDD Conference on Knowledge Discovery and Data Mining (KDD '24)
     ArXiv: https://arxiv.org/abs/2311.09735
     Key Finding: Adding factual statistics (+35-42%) and citations (+30-40%) drastically
     boosts LLM citation rates; keyword stuffing drops visibility by 15-20%.

  2. ${BOLD}"ColBERT: Contextualized Late Interaction over BERT"${RESET}
     Authors: Khattab & Zaharia (Stanford University) — ACM SIGIR
     ArXiv: https://arxiv.org/abs/2004.12832
     Key Finding: Late-interaction neural reranking splits pages into 256–512 token chunks.
     BLUF architecture ensures the query and definitive answer reside in the same chunk.

  3. ${BOLD}"Lost in the Middle: How Language Models Use Long Contexts"${RESET}
     Authors: Liu et al. (Stanford / UC Berkeley) — TACL '24
     ArXiv: https://arxiv.org/abs/2307.03172
     Key Finding: LLMs extract information with greatest fidelity at the beginning
     and end of input context. Structured /llms.txt headers exploit this primacy bias.

${BOLD}READ THE FULL DOSSIER:${RESET}
  docs/research/academic-foundations.md
`)
}
