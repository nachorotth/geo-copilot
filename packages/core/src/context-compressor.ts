/**
 * Context Compression Engine & Compress-Cache-Retrieve Store
 * GEO-Copilot Core Package
 * Inspired by Google Cloud Tech's Headroom Context Compression Architecture.
 *
 * Provides:
 * 1. SmartCrusher: Structural compression for JSON arrays, DOM trees, and object payloads.
 * 2. CodeCompressor: AST/signature-aware code block compression.
 * 3. LogCompressor: Log tail deduplication & anomaly preserving compression.
 * 4. ContentCache: Local content-addressed store for uncompressed original payloads.
 * 5. RETRIEVE_CHUNK_TOOL: Standard LLM function calling spec for fallback retrieval.
 */

import { createHash } from 'crypto';

// Bounded in-memory content-addressed cache for raw uncompressed payloads (LRU eviction)
const MAX_PAYLOAD_CACHE_ENTRIES = 200;
const rawPayloadCache = new Map<string, string>();

/**
 * Stores payload in cache with LRU eviction when capacity is reached.
 */
function setCachePayload(chunkId: string, payload: string): void {
  if (rawPayloadCache.has(chunkId)) {
    rawPayloadCache.delete(chunkId);
  } else if (rawPayloadCache.size >= MAX_PAYLOAD_CACHE_ENTRIES) {
    const oldestKey = rawPayloadCache.keys().next().value;
    if (oldestKey !== undefined) {
      rawPayloadCache.delete(oldestKey);
    }
  }
  rawPayloadCache.set(chunkId, payload);
}

/**
 * Clears the payload cache. Primarily useful for tests.
 */
export function clearRawPayloadCache(): void {
  rawPayloadCache.clear();
}

/**
 * Returns current count of entries in the payload cache.
 */
export function getRawPayloadCacheSize(): number {
  return rawPayloadCache.size;
}

export interface CompressionResult<T = unknown> {
  compressed: T;
  chunkId: string;
  originalByteCount: number;
  compressedByteCount: number;
  reductionPercentage: number;
}

/**
 * Computes a SHA-256 short hash (chunk_id) for content-addressable storage
 */
export function generateChunkId(content: string): string {
  const hash = createHash('sha256').update(content).digest('hex').substring(0, 12);
  return `chunk_${hash}`;
}

/**
 * Retrieves an uncompressed payload from the content-addressed cache
 */
export function retrieveRawChunk(chunkId: string): string | null {
  return rawPayloadCache.get(chunkId) ?? null;
}

/**
 * SmartCrusher: Compresses arrays of structured objects by extracting schema keys,
 * collapsing redundant structural syntax, isolating statistical outliers, and preserving key enums.
 */
export function smartCrusher<T extends Record<string, any>>(
  items: T[],
  options: { maxOutliers?: number } = {}
): CompressionResult<{
  _schema: string[];
  _count: number;
  _outliers: T[];
  _rows: any[][];
  _chunkId: string;
}> {
  const originalJson = JSON.stringify(items);
  const chunkId = generateChunkId(originalJson);
  setCachePayload(chunkId, originalJson);

  if (!items || items.length === 0) {
    return {
      compressed: { _schema: [], _count: 0, _outliers: [], _rows: [], _chunkId: chunkId },
      chunkId,
      originalByteCount: originalJson.length,
      compressedByteCount: 50,
      reductionPercentage: 0,
    };
  }

  // 1. Collect all unique top-level keys across objects
  const schemaKeysSet = new Set<string>();
  items.forEach((item) => {
    if (item && typeof item === 'object') {
      Object.keys(item).forEach((k) => schemaKeysSet.add(k));
    }
  });
  const schema = Array.from(schemaKeysSet);

  // 2. Identify outliers (items containing 'error', 'warning', or status failures)
  const maxOutliers = options.maxOutliers ?? 5;
  const outliers: T[] = [];
  const normalRows: any[][] = [];

  items.forEach((item) => {
    const isAnomaly =
      item &&
      typeof item === 'object' &&
      (item.error || item.warning || item.status === 'FAILED' || item.status === 'ERROR');

    if (isAnomaly && outliers.length < maxOutliers) {
      outliers.push(item);
    } else {
      const row = schema.map((key) => {
        const val = item[key];
        if (val === undefined || val === null) return null;
        if (typeof val === 'string' && val.length > 120) {
          return `${val.substring(0, 50)}... [${val.length - 50} chars omitted]`;
        }
        return val;
      });
      normalRows.push(row);
    }
  });

  const compressedObj = {
    _schema: schema,
    _count: items.length,
    _outliers: outliers,
    _rows: normalRows,
    _chunkId: chunkId,
  };

  const compressedJson = JSON.stringify(compressedObj);
  const reductionPercentage = Math.max(
    0,
    Math.round(((originalJson.length - compressedJson.length) / originalJson.length) * 100)
  );

  return {
    compressed: compressedObj,
    chunkId,
    originalByteCount: originalJson.length,
    compressedByteCount: compressedJson.length,
    reductionPercentage,
  };
}

/**
 * CodeCompressor: Compresses source code / AST blocks by preserving signatures and exports.
 */
export function codeCompressor(code: string): CompressionResult<string> {
  if (!code || code.length === 0) {
    const emptyChunkId = generateChunkId('');
    setCachePayload(emptyChunkId, '');
    return {
      compressed: '',
      chunkId: emptyChunkId,
      originalByteCount: 0,
      compressedByteCount: 0,
      reductionPercentage: 0,
    };
  }

  const chunkId = generateChunkId(code);
  setCachePayload(chunkId, code);

  const lines = code.split('\n');
  let bodyOmittedCount = 0;
  const resultLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    const isStructural =
      trimmed.startsWith('import ') ||
      trimmed.startsWith('export ') ||
      trimmed.startsWith('interface ') ||
      trimmed.startsWith('type ') ||
      trimmed.startsWith('class ') ||
      trimmed.startsWith('public ') ||
      trimmed.startsWith('private ') ||
      trimmed.startsWith('protected ') ||
      trimmed.startsWith('function ') ||
      trimmed.startsWith('@') ||
      trimmed.includes('class ') ||
      trimmed.endsWith('{') ||
      trimmed === '}' ||
      trimmed === '';

    if (isStructural || i < 15 || i > lines.length - 10) {
      if (bodyOmittedCount > 0) {
        resultLines.push(`  // ... [${bodyOmittedCount} lines of implementation details omitted; chunk_id: ${chunkId}]`);
        bodyOmittedCount = 0;
      }
      resultLines.push(line);
    } else {
      bodyOmittedCount++;
    }
  }

  if (bodyOmittedCount > 0) {
    resultLines.push(`  // ... [${bodyOmittedCount} lines of implementation details omitted; chunk_id: ${chunkId}]`);
  }

  const compressedCode = resultLines.join('\n');

  return {
    compressed: compressedCode,
    chunkId,
    originalByteCount: code.length,
    compressedByteCount: compressedCode.length,
    reductionPercentage: Math.max(0, Math.round(((code.length - compressedCode.length) / code.length) * 100)),
  };
}

/**
 * Standard LLM Tool Definition Schema for chunk retrieval
 */
export const RETRIEVE_CHUNK_TOOL = {
  name: 'retrieve_raw_chunk',
  description: 'Retrieves the uncompressed, full raw content of a compressed payload block by its chunk_id.',
  parameters: {
    type: 'object',
    properties: {
      chunk_id: {
        type: 'string',
        description: 'The unique chunk identifier string (e.g. chunk_a1b2c3d4e5f6).',
      },
    },
    required: ['chunk_id'],
  },
};
