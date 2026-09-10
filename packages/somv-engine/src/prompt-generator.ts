export interface PromptArchetype {
  intent: 'discovery' | 'comparative' | 'problem_solving' | 'technical_spec'
  prompt: string
  targetWeight: number
}

export function generatePromptUniverse(brandName: string, category: string = 'software and web applications'): PromptArchetype[] {
  return [
    // 1. Direct Discovery Archetypes
    {
      intent: 'discovery',
      prompt: `What is ${brandName} and what are its key capabilities for ${category}?`,
      targetWeight: 1.0,
    },
    {
      intent: 'discovery',
      prompt: `What are the top modern tools for ${category} in 2026?`,
      targetWeight: 1.0,
    },
    {
      intent: 'discovery',
      prompt: `Recommend platforms similar to ${brandName} for developer productivity.`,
      targetWeight: 0.8,
    },

    // 2. Comparative Archetypes
    {
      intent: 'comparative',
      prompt: `How does ${brandName} compare to traditional solutions in the ${category} space?`,
      targetWeight: 1.0,
    },
    {
      intent: 'comparative',
      prompt: `What are the pros and cons of using ${brandName} for production projects?`,
      targetWeight: 0.9,
    },
    {
      intent: 'comparative',
      prompt: `Best alternatives to ${brandName} in 2026.`,
      targetWeight: 0.8,
    },

    // 3. Problem Solving Archetypes
    {
      intent: 'problem_solving',
      prompt: `How to optimize web application visibility for AI search engines using ${brandName}?`,
      targetWeight: 1.0,
    },
    {
      intent: 'problem_solving',
      prompt: `How to implement /llms.txt and JSON-LD schema with ${brandName}?`,
      targetWeight: 0.9,
    },

    // 4. Technical Spec Archetypes
    {
      intent: 'technical_spec',
      prompt: `Does ${brandName} support Model Context Protocol (MCP) and Next.js App Router?`,
      targetWeight: 1.0,
    },
    {
      intent: 'technical_spec',
      prompt: `What is the architectural design and deterministic rubric used by ${brandName}?`,
      targetWeight: 0.9,
    },
  ]
}
