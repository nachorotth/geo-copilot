// ============================================================
// GEO-Copilot – Core Open-Source Type Definitions
// ============================================================

// --- Enums ---

export type AuditMode = 'url' | 'repo'

export type AuditStatus = 'pending' | 'running' | 'completed' | 'failed'

export type Pillar =
  | 'crawler_layer'
  | 'knowledge_graph'
  | 'information_gain'
  | 'bluf_architecture'
  | 'somv'

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type ArtifactType =
  | 'llms_txt'
  | 'llms_full_txt'
  | 'jsonld_graph'
  | 'bluf_rewrite'
  | 'robots_patch'
  | 'middleware_patch'
  | 'sitemap_patch'

export type MutationClass = 'A' | 'B' | 'C'

export type MutationStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'applied'

export type PRStatus = 'open' | 'merged' | 'closed' | 'draft'

export type GitProvider = 'github' | 'gitlab' | 'bitbucket'

export type AIEngine =
  | 'perplexity'
  | 'chatgpt_search'
  | 'gemini'
  | 'claude'
  | 'copilot'
  | 'grok'

export type SoMVClassification = 'recommendation' | 'citation' | 'mention' | 'none'

// --- Core Entities ---

export interface Project {
  id: string
  name: string
  domain: string | null
  repoUrl?: string | null
  repoProvider?: GitProvider | null
  framework?: string | null
  createdAt?: Date
  updatedAt?: Date
}

export interface AuditRun {
  id: string
  projectId: string | null
  targetUrl: string | null
  repoUrl: string | null
  mode: AuditMode
  status: AuditStatus
  geoScore: number | null
  pillarScores: PillarScores | null
  errorMessage: string | null
  triggeredBy: string // 'user' | 'webhook' | 'scheduled' | 'anonymous'
  createdAt: Date
  completedAt: Date | null
}

export interface PillarScores {
  crawler_layer: PillarScore
  knowledge_graph: PillarScore
  information_gain: PillarScore
  bluf_architecture: PillarScore
  somv: PillarScore
}

export interface PillarScore {
  score: number // 0–20
  maxScore: 20
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  summary: string
}

export interface Finding {
  id: string
  auditRunId: string
  pillar: Pillar
  severity: FindingSeverity
  title: string
  description: string
  recommendation: string
  location: FindingLocation | null
  autoFixable: boolean
  estimatedImpact: number // 0–10, score impact if fixed
  ruleId?: string
  createdAt: Date
}

export interface FindingLocation {
  type: 'url' | 'file'
  value: string // URL or file path
  line?: number
  column?: number
}

export interface Artifact {
  id: string
  auditRunId: string
  type: ArtifactType
  targetPath: string // e.g. 'public/llms.txt' or 'app/robots.ts'
  contentUrl: string | null // S3/R2 URL or internal URL
  content: string | null // Raw generated content for immediate preview
  sizeBytes: number
  mimeType: string
  createdAt: Date
}

export interface MutationPlan {
  id: string
  auditRunId: string
  projectId?: string
  class: MutationClass
  title: string
  rationale: string
  changes: FileChange[]
  rollbackInstructions: string
  estimatedRisk: 'none' | 'low' | 'medium' | 'high'
  requiresApproval: boolean
  status: MutationStatus
  createdAt: Date
  updatedAt: Date
}

export interface FileChange {
  path: string
  type: 'create' | 'modify' | 'delete'
  before: string | null
  after: string | null
  mimeType: string
}

export interface SoMVSnapshot {
  id: string
  projectId?: string
  promptSetId?: string
  engine: AIEngine
  prompt: string
  responseSnippet: string | null
  responseUrl?: string | null
  classification: SoMVClassification
  somvScore: number // 0–100
  weightedScore: number // 1.0 | 0.7 | 0.4 | 0.0 depending on classification
  timestamp: Date
}

export interface PromptSet {
  id: string
  name: string
  description: string
  prompts: PromptEntry[]
  isSystemDefault: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PromptEntry {
  id: string
  text: string
  category: string // e.g. 'product_comparison', 'best_tool_for', 'technical_how_to'
  targetEngines: AIEngine[]
}

export interface GEOScore {
  total: number // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  pillars: PillarScores
  somv: number | null // SoMV 0–100, null if not yet measured
  auditRunId: string
  computedAt: Date
}

// --- API Types ---

export interface ApiResponse<T> {
  data: T
  meta: {
    requestId: string
    timestamp: string
    version: string
  }
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
  }
  meta: {
    requestId: string
    timestamp: string
    version: string
  }
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
  meta: {
    requestId: string
    timestamp: string
    version: string
  }
}

// --- Crawler Types ---

export interface CrawlResult {
  url: string
  crawledAt: Date
  durationMs: number
  ssrHtml: string | null
  hydratedHtml: string | null
  robotsTxt: string | null
  robotsRules: RobotsRule[]
  sitemapUrl: string | null
  sitemapXml: string | null
  llmsTxt: string | null
  llmsFullTxt: string | null
  markdownNegotiationSupported: boolean
  markdownContent: string | null
  statusCode: number
  headers: Record<string, string>
  error: string | null
}

export interface RobotsRule {
  userAgent: string
  allow: string[]
  disallow: string[]
}

// --- AST / Static Analysis Types ---

export interface StaticAnalysisResult {
  repoUrl: string
  framework: string
  analyzedAt: Date
  durationMs: number
  routes: RouteInfo[]
  findings: StaticFinding[]
  hasRobotsTsOrTxt: boolean
  hasSitemapTs: boolean
  hasMiddlewareTsOrJs: boolean
  hasLlmsTxt: boolean
  hasLlmsFullTxt: boolean
}

export interface RouteInfo {
  path: string
  filePath: string
  isClientComponent: boolean
  hasMetadataExport: boolean
  hasGenerateMetadata: boolean
  hasGenerateStaticParams: boolean
  hasJsonLdScript: boolean
  jsonLdTypes: string[]
}

export interface StaticFinding {
  filePath: string
  line: number | null
  ruleId: string
  severity: FindingSeverity
  message: string
}

// --- Pluggable Infrastructure Interfaces ---

export interface CrawlerProxyConfig {
  server: string
  username?: string
  password?: string
}

export interface CrawlerTransport {
  readonly name: string
  getProxyConfig?(targetUrl: string): Promise<CrawlerProxyConfig | null>
  fetchAuxiliary?(
    url: string,
    headers?: Record<string, string>
  ): Promise<{ status: number; text: string; headers: Record<string, string> }>
}

export interface ProbeResult {
  engine: AIEngine
  prompt: string
  response: string
  durationMs: number
  error?: string
}

export interface ProberGateway {
  readonly name: string
  probe(
    prompt: string,
    engine: AIEngine,
    options?: { targetBrand?: string }
  ): Promise<ProbeResult>
}


