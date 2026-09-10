#!/usr/bin/env node

import { parseArgs } from 'node:util'
import { crawlUrl } from '@geo-copilot/crawler'
import { GEOScoringEngine } from '@geo-copilot/scorer'
import {
  generateLlmsTxtFromCrawl,
  generateJsonLdGraphFromCrawl,
  generateRobotsTs,
  generateMarkdownMiddlewarePatch,
} from '@geo-copilot/artifact-gen'
import { generatePromptUniverse } from '@geo-copilot/somv-engine'
import { formatTerminalScorecard } from './formatters/terminal.js'
import {
  printMainHelp,
  printAuditHelp,
  printGenerateHelp,
  printSomvHelp,
  printAgentHelp,
  printResearchHelp,
} from './help.js'

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    printMainHelp()
    return
  }

  const command = args[0].toLowerCase()

  if (command === '--version' || command === '-v') {
    console.log('geo-copilot v0.1.0')
    return
  }

  // Handle "geo-copilot help [command]"
  if (command === 'help') {
    const sub = args[1]?.toLowerCase()
    switch (sub) {
      case 'audit':
      case 'scan':
        printAuditHelp()
        return
      case 'generate':
      case 'gen':
        printGenerateHelp()
        return
      case 'somv':
      case 'probe':
        printSomvHelp()
        return
      case 'agent':
      case 'geoagent':
        printAgentHelp()
        return
      case 'research':
      case 'paper':
      case 'papers':
        printResearchHelp()
        return
      default:
        printMainHelp()
        return
    }
  }

  // Handle "geo-copilot <command> --help / -h" or general "--help"
  if (args.includes('--help') || args.includes('-h')) {
    switch (command) {
      case 'audit':
      case 'scan':
        printAuditHelp()
        return
      case 'generate':
      case 'gen':
        printGenerateHelp()
        return
      case 'somv':
      case 'probe':
        printSomvHelp()
        return
      case 'agent':
      case 'geoagent':
        printAgentHelp()
        return
      case 'research':
      case 'paper':
      case 'papers':
        printResearchHelp()
        return
      default:
        printMainHelp()
        return
    }
  }

  switch (command) {
    case 'audit':
    case 'scan': {
      const url = args[1]
      if (!url || !url.startsWith('http')) {
        console.error('Error: Please provide a valid URL to audit (e.g. `geo-copilot audit https://example.com`)')
        console.error('Run `geo-copilot audit --help` for full options.\n')
        process.exit(1)
      }

      const { values } = parseArgs({
        args: args.slice(2),
        options: {
          format: { type: 'string', short: 'f', default: 'terminal' },
          output: { type: 'string', short: 'o' },
          json: { type: 'boolean', default: false },
        },
        allowPositionals: true,
      })

      console.log(`\n⏳ Crawling ${url} with simulated AI bot user-agents...`)
      const startTime = Date.now()

      try {
        const crawlResult = await crawlUrl(url, {
          timeout: 30000,
          fetchHydrated: true,
          testMarkdownNegotiation: true,
        })

        if (crawlResult.error) {
          console.error(`\n❌ Crawl error: Could not connect to ${url}\n   Details: ${crawlResult.error}\n`)
          process.exit(1)
        }

        const scoringEngine = new GEOScoringEngine()
        const scoringOutput = scoringEngine.score({ crawlResult })
        const duration = ((Date.now() - startTime) / 1000).toFixed(1)

        if (values.json || values.format === 'json') {
          const jsonStr = JSON.stringify({ url, durationSeconds: Number(duration), ...scoringOutput }, null, 2)
          if (values.output) {
            const fs = await import('node:fs/promises')
            await fs.writeFile(values.output, jsonStr, 'utf-8')
            console.log(`✅ Audit report saved to ${values.output}`)
          } else {
            console.log(jsonStr)
          }
          return
        }

        const terminalOutput = formatTerminalScorecard(url, scoringOutput)
        console.log(terminalOutput)
        console.log(`⚡ Audit completed in ${duration}s.\n`)
      } catch (err) {
        console.error(`❌ Audit failed: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(1)
      }
      break
    }

    case 'generate':
    case 'gen': {
      const url = args[1]
      if (!url || !url.startsWith('http')) {
        console.error('Error: Please provide a target URL (e.g. `geo-copilot generate https://example.com --type llms_txt`)')
        console.error('Run `geo-copilot generate --help` for full options.\n')
        process.exit(1)
      }

      let content = ''

      const { values } = parseArgs({
        args: args.slice(2),
        options: {
          type: { type: 'string', short: 't', default: 'llms_txt' },
          output: { type: 'string', short: 'o' },
        },
        allowPositionals: true,
      })

      console.log(`\n⏳ Crawling ${url} to extract real site metadata & sitemap...`)
      let crawlResult: Awaited<ReturnType<typeof crawlUrl>>
      try {
        crawlResult = await crawlUrl(url, {
          timeout: 30000,
          fetchHydrated: true,
          testMarkdownNegotiation: true,
        })
      } catch (err) {
        console.error(`❌ Crawl failed: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(1)
      }

      switch (values.type) {
        case 'llms_txt':
        case 'llms.txt':
          content = generateLlmsTxtFromCrawl(crawlResult)
          break
        case 'jsonld':
        case 'json-ld': {
          const graphObj = generateJsonLdGraphFromCrawl(crawlResult)
          content = `<script type="application/ld+json">\n${JSON.stringify(graphObj, null, 2)}\n</script>`
          break
        }
        case 'robots':
        case 'robots.ts':
          content = generateRobotsTs({ siteUrl: url })
          break
        case 'middleware':
          content = generateMarkdownMiddlewarePatch()
          break
        default:
          console.error(`Unknown artifact type "${values.type}". Available: llms_txt, jsonld, robots, middleware`)
          console.error('Run `geo-copilot generate --help` for descriptions of each type.\n')
          process.exit(1)
      }

      if (values.output) {
        const fs = await import('node:fs/promises')
        await fs.writeFile(values.output, content, 'utf-8')
        console.log(`✅ Generated ${values.type} saved to ${values.output}`)
      } else {
        console.log(content)
      }
      break
    }

    case 'somv':
    case 'probe': {
      const brand = args[1]
      if (!brand) {
        console.error('Error: Please provide a brand or product name (e.g. `geo-copilot somv "MyProduct"`)')
        console.error('Run `geo-copilot somv --help` for details.\n')
        process.exit(1)
      }

      const prompts = generatePromptUniverse(brand)
      console.log(`\n🧭 Share of Model Voice (SoMV) Synthetic Benchmark: "${brand}"`)
      console.log(`Generated ${prompts.length} benchmark prompts across 4 intent archetypes:\n`)

      prompts.forEach((p: { intent: string; targetWeight: number; prompt: string }, idx: number) => {
        console.log(`  ${idx + 1}. [${p.intent.toUpperCase()}] (Weight: ${p.targetWeight})`)
        console.log(`     > "${p.prompt}"\n`)
      })

      console.log('Attribution Scoring Standard:')
      console.log('  - Recommendation (1.0): Brand explicitly recommended as top solution')
      console.log('  - Citation (0.7): Brand cited with verifiable domain/URL reference')
      console.log('  - Mention (0.4): Brand listed among alternatives or competitors')
      console.log('  - None (0.0): Brand not cited or recognized in generated answer\n')
      break
    }

    case 'agent':
    case 'geoagent': {
      printAgentHelp()
      break
    }

    case 'research':
    case 'papers': {
      printResearchHelp()
      break
    }

    default:
      console.error(`Unknown command "${command}".`)
      console.error('Run `geo-copilot --help` to see available commands.\n')
      process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
