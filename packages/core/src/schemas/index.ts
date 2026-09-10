import { z } from 'zod'

export const AuditModeSchema = z.enum(['url', 'repo'])

export const PillarSchema = z.enum([
  'crawler_layer',
  'knowledge_graph',
  'information_gain',
  'bluf_architecture',
  'somv',
])

export const AIEngineSchema = z.enum([
  'perplexity',
  'chatgpt_search',
  'gemini',
  'claude',
  'copilot',
  'grok',
])

export const MutationClassSchema = z.enum(['A', 'B', 'C'])

// POST /v1/audit
export const TriggerAuditSchema = z.object({
  projectId: z.string().optional(),
  url: z.string().url().optional(),
  repoUrl: z.string().url().optional(),
  mode: AuditModeSchema,
  branch: z.string().optional(),
}).refine(
  (d) => d.url || d.repoUrl || d.projectId,
  { message: 'One of url, repoUrl, or projectId is required' },
)

// POST /v1/artifacts
export const GenerateArtifactSchema = z.object({
  auditRunId: z.string(),
  types: z.array(
    z.enum(['llms_txt', 'llms_full_txt', 'jsonld_graph', 'bluf_rewrite', 'robots_patch', 'middleware_patch', 'sitemap_patch'])
  ).min(1),
})

// POST /v1/mutations/plan
export const GenerateMutationPlanSchema = z.object({
  auditRunId: z.string(),
  classes: z.array(MutationClassSchema).default(['A', 'B']),
})

// POST /v1/somv/probe
export const TriggerSoMVProbeSchema = z.object({
  projectId: z.string().optional(),
  promptSetId: z.string().optional(),
  engines: z.array(AIEngineSchema).optional(),
})

