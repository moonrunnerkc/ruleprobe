/**
 * Tests for cross-file consistency checking.
 */

import { describe, it, expect } from 'vitest';
import type { CrossFileGraph } from '../../../../src/semantic/types.js';
import {
  checkConsistency,
  applyAdjustment,
  produceCrossFileFindings,
  CONSISTENCY_BOOST,
  DEVIATION_PENALTY,
} from '../../../../src/semantic/engine/comparison/cross-file-checker.js';

function makeGraph(
  edgeData: Record<string, Record<string, string[]>>,
): CrossFileGraph {
  const edges = new Map<string, Map<string, string[]>>();
  for (const [fileId, sigs] of Object.entries(edgeData)) {
    const inner = new Map<string, string[]>();
    for (const [sig, peers] of Object.entries(sigs)) {
      inner.set(sig, peers);
    }
    edges.set(fileId, inner);
  }
  return { edges };
}

describe('checkConsistency', () => {
  it('boosts when peers are consistent and target matches', () => {
    const graph = makeGraph({
      '0': { sigA: ['1', '2'] },
      '1': { sigA: ['0', '2'] },
      '2': { sigA: ['0', '1'] },
    });
    const result = checkConsistency(graph, '0', 'sigA');
    expect(result.peersConsistent).toBe(true);
    expect(result.targetMatchesPeers).toBe(true);
    expect(result.adjustment).toBe(CONSISTENCY_BOOST);
  });

  it('penalizes when peers are consistent but target deviates', () => {
    const graph = makeGraph({
      '0': { sigB: ['1'] },
    });
    // File '0' has peers under sigB, but we query for sigA
    const result = checkConsistency(graph, '0', 'sigA');
    expect(result.peersConsistent).toBe(true);
    expect(result.targetMatchesPeers).toBe(false);
    expect(result.adjustment).toBe(-DEVIATION_PENALTY);
  });

  it('returns no adjustment when file has no edges', () => {
    const graph = makeGraph({});
    const result = checkConsistency(graph, '0', 'sigA');
    expect(result.adjustment).toBe(0);
  });

  it('returns no adjustment when peers are inconsistent', () => {
    // File exists in graph but has no peers at all
    const graph = makeGraph({
      '0': {},
    });
    const result = checkConsistency(graph, '0', 'sigA');
    expect(result.peersConsistent).toBe(false);
    expect(result.adjustment).toBe(0);
  });

  it('CONSISTENCY_BOOST is 0.05', () => {
    expect(CONSISTENCY_BOOST).toBe(0.05);
  });

  it('DEVIATION_PENALTY is 0.1', () => {
    expect(DEVIATION_PENALTY).toBe(0.1);
  });
});

describe('applyAdjustment', () => {
  it('boosts compliance within bounds', () => {
    expect(applyAdjustment(0.9, 0.05)).toBeCloseTo(0.95, 10);
  });

  it('caps at 1.0', () => {
    expect(applyAdjustment(0.98, 0.05)).toBe(1.0);
  });

  it('floors at 0.0', () => {
    expect(applyAdjustment(0.05, -0.1)).toBe(0.0);
  });

  it('passes through with zero adjustment', () => {
    expect(applyAdjustment(0.75, 0)).toBe(0.75);
  });
});

describe('produceCrossFileFindings', () => {
  it('produces findings for consistent file groups', () => {
    const graph = makeGraph({
      '0': { sigA: ['1'] },
      '1': { sigA: ['0'] },
    });
    const vectors = {
      '0': { nodeTypeCounts: {}, nestingDepths: {}, subTreeHashes: [] },
      '1': { nodeTypeCounts: {}, nestingDepths: {}, subTreeHashes: [] },
    };
    const findings = produceCrossFileFindings(graph, vectors, ['error-handling']);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.consistentFiles.length).toBe(2);
  });

  it('returns empty for no groups', () => {
    const graph = makeGraph({});
    const findings = produceCrossFileFindings(graph, {}, ['error-handling']);
    expect(findings.length).toBe(0);
  });
});
