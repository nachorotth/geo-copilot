# @geo-copilot/core

> TypeScript domain models, Zod validation schemas, scoring algorithms, and context compression engine for GEO-Copilot (Generative Engine Optimization).

[![npm version](https://img.shields.io/npm/v/@geo-copilot/core.svg)](https://www.npmjs.com/package/@geo-copilot/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Overview

`@geo-copilot/core` is the foundational, zero-dependency domain package powering the GEO-Copilot suite. It encapsulates:

- **Strict TypeScript Types**: Types for audits, findings, mutation plans, crawl results, and Share of Model Voice (SoMV).
- **Zod Schemas**: Runtime validation schemas for audit triggers, mutation approvals, and probe requests.
- **Deterministic Scoring Math**: 100-point rubric across the 5 pillars of Generative Engine Optimization (Crawler, Knowledge Graph, Information Gain, BLUF, SoMV).
- **Context Compression Engine**: Google Headroom-inspired structural compression (`smartCrusher`, `codeCompressor`) with bounded content-addressable caching for agent token conservation.

---

## Installation

```bash
# Using pnpm
pnpm add @geo-copilot/core

# Using npm
npm install @geo-copilot/core

# Using yarn
yarn add @geo-copilot/core
```

---

## Exports & Subpaths

`@geo-copilot/core` supports modern conditional exports (`NodeNext` / `Bundler`):

| Import Path | Contents |
|---|---|
| `@geo-copilot/core` | Complete bundle: types, schemas, scoring utilities, constants, context compressor |
| `@geo-copilot/core/types` | Pure TypeScript type definitions (`Project`, `AuditRun`, `GEOScore`, `CrawlResult`, etc.) |
| `@geo-copilot/core/schemas` | Zod validation schemas (`TriggerAuditSchema`, `AIEngineSchema`, etc.) |

---

## Quick Start

### 1. Scoring & Grades

```typescript
import { computeGrade, computeSoMV, computeTotalGeoScore } from '@geo-copilot/core';

// Compute letter grade from score and maximum
const grade = computeGrade(82, 100); // Returns 'B'

// Calculate Share of Model Voice (SoMV) percentage
const somv = computeSoMV([
  { classification: 'recommendation' }, // weight: 1.0
  { classification: 'citation' },       // weight: 0.7
  { classification: 'mention' },        // weight: 0.4
  { classification: 'none' },           // weight: 0.0
]);
console.log(`SoMV: ${somv}%`); // Output: 52.5%
```

### 2. Context Compression for LLM / Agent Pipelines

```typescript
import { smartCrusher, codeCompressor, retrieveRawChunk } from '@geo-copilot/core';

// Compress structural JSON payloads
const rawItems = [
  { id: '1', name: 'Alpha', score: 95, details: 'Long payload...' },
  { id: '2', name: 'Beta', score: 80, details: 'Long payload...' },
];

const result = smartCrusher(rawItems);
console.log(`Saved ${result.reductionPercentage}% tokens. Chunk ID: ${result.chunkId}`);

// Uncompressed raw payload can be retrieved by chunk ID on demand
const original = retrieveRawChunk(result.chunkId);
```

### 3. Zod Schema Validation

```typescript
import { TriggerAuditSchema } from '@geo-copilot/core/schemas';

const result = TriggerAuditSchema.safeParse({
  url: 'https://example.com',
  mode: 'url',
});

if (result.success) {
  console.log('Valid audit payload:', result.data);
}
```

---

## License

MIT © [GEO-Copilot Contributors](https://github.com/geo-copilot/geo-copilot)
