import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGrade,
  computeSoMV,
  computeTotalGeoScore,
  codeCompressor,
  smartCrusher,
  retrieveRawChunk,
  clearRawPayloadCache,
  getRawPayloadCacheSize,
  generateChunkId,
} from './index.js';

describe('Scoring Algorithms', () => {
  test('computeGrade returns accurate grades across boundary percentiles', () => {
    assert.equal(computeGrade(90, 100), 'A');
    assert.equal(computeGrade(89, 100), 'B');
    assert.equal(computeGrade(75, 100), 'B');
    assert.equal(computeGrade(60, 100), 'C');
    assert.equal(computeGrade(40, 100), 'D');
    assert.equal(computeGrade(39, 100), 'F');
    assert.equal(computeGrade(0, 100), 'F');
  });

  test('computeGrade defensively handles invalid or zero max bounds', () => {
    assert.equal(computeGrade(50, 0), 'F');
    assert.equal(computeGrade(50, -10), 'F');
    assert.equal(computeGrade(NaN, 100), 'F');
    assert.equal(computeGrade(50, NaN), 'F');
  });

  test('computeSoMV calculates weighted percentage correctly', () => {
    const emptyResult = computeSoMV([]);
    assert.equal(emptyResult, 0);

    const normalResults = computeSoMV([
      { classification: 'recommendation' }, // 1.0
      { classification: 'citation' },       // 0.7
      { classification: 'mention' },        // 0.4
      { classification: 'none' },           // 0.0
    ]);
    // sum = 2.1, N = 4 -> 2.1 / 4 * 100 = 52.5
    assert.equal(normalResults, 52.5);
  });

  test('computeSoMV defensively falls back to 0.0 on unrecognized classification without NaN', () => {
    const fallbackResults = computeSoMV([
      { classification: 'recommendation' }, // 1.0
      { classification: 'unexpected_label' }, // fallback: 0.0
    ]);
    // sum = 1.0, N = 2 -> 50%
    assert.equal(fallbackResults, 50);
    assert.equal(Number.isNaN(fallbackResults), false);
  });

  test('computeTotalGeoScore sums all pillar scores', () => {
    const total = computeTotalGeoScore({
      crawler: { score: 18, maxScore: 20, grade: 'A', summary: 'Good' },
      kg: { score: 14, maxScore: 20, grade: 'C', summary: 'Average' },
      ig: { score: 16, maxScore: 20, grade: 'B', summary: 'Solid' },
    });
    assert.equal(total, 48);
  });
});

describe('Context Compressor', () => {
  test('codeCompressor gracefully handles empty string without producing NaN', () => {
    const result = codeCompressor('');
    assert.equal(result.compressed, '');
    assert.equal(result.originalByteCount, 0);
    assert.equal(result.compressedByteCount, 0);
    assert.equal(result.reductionPercentage, 0);
    assert.equal(Number.isNaN(result.reductionPercentage), false);
  });

  test('codeCompressor compresses code and allows chunk retrieval', () => {
    const sampleCode = `
import { foo } from 'bar';
export function calculate(a: number, b: number): number {
  const step1 = a * 2;
  const step2 = b * 3;
  const step3 = step1 + step2;
  const step4 = step3 * 4;
  const step5 = step4 - 10;
  const step6 = step5 / 2;
  const step7 = step6 + 1;
  const step8 = step7 * 2;
  const step9 = step8 - 3;
  const step10 = step9 + 4;
  const step11 = step10 * 5;
  const step12 = step11 - 6;
  const step13 = step12 + 7;
  const step14 = step13 * 8;
  const step15 = step14 - 9;
  const step16 = step15 + 10;
  const step17 = step16 * 11;
  const step18 = step17 - 12;
  return step18;
}
`;
    const result = codeCompressor(sampleCode);
    assert.ok(result.chunkId.startsWith('chunk_'));
    assert.equal(retrieveRawChunk(result.chunkId), sampleCode);
  });

  test('smartCrusher extracts schema and supports chunk retrieval', () => {
    const items = [
      { id: '1', name: 'Item 1', status: 'OK', value: 100 },
      { id: '2', name: 'Item 2', status: 'OK', value: 200 },
      { id: '3', name: 'Item 3', status: 'ERROR', value: 0 },
    ];
    const result = smartCrusher(items);
    assert.ok(result.chunkId.startsWith('chunk_'));
    assert.equal(result.compressed._count, 3);
    assert.equal(result.compressed._outliers.length, 1);
    assert.equal(retrieveRawChunk(result.chunkId), JSON.stringify(items));
  });

  test('cache adheres to bounded LRU limit and evicts oldest items', () => {
    clearRawPayloadCache();
    assert.equal(getRawPayloadCacheSize(), 0);

    // Insert 205 items (capacity is 200)
    for (let i = 0; i < 205; i++) {
      codeCompressor(`// code snippet unique item ${i}`);
    }

    assert.equal(getRawPayloadCacheSize(), 200);

    // Oldest items (0..4) should have been evicted
    const firstChunkId = generateChunkId('// code snippet unique item 0');
    assert.equal(retrieveRawChunk(firstChunkId), null);

    // Newest item (204) should still be in cache
    const latestChunkId = generateChunkId('// code snippet unique item 204');
    assert.equal(retrieveRawChunk(latestChunkId), '// code snippet unique item 204');
  });
});
