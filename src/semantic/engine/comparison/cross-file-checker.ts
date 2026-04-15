/**
 * Cross-file consistency checking.
 *
 * Analyzes the CrossFileGraph to determine whether files sharing
 * a pattern topic are consistent, and applies deterministic
 * compliance adjustments.
 */

import type {
  CrossFileGraph,
  CrossFileFinding,
  PatternTopic,
  RawFileVector,
} from '../../types.js';

/**
 * Compliance boost when peers are consistent and target matches.
 * Capped at 1.0.
 *
 * Source: ASPE architecture spec, deterministic adjustment.
 */
export const CONSISTENCY_BOOST = 0.05;

/**
 * Compliance penalty when peers are consistent but target deviates.
 *
 * Source: ASPE architecture spec, deterministic adjustment.
 */
export const DEVIATION_PENALTY = 0.1;

/** Result of checking cross-file consistency for a single file. */
export interface ConsistencyResult {
  /** Whether peers of this file are consistent with each other */
  peersConsistent: boolean;
  /** Whether the target matches its peers */
  targetMatchesPeers: boolean;
  /** Compliance adjustment to apply */
  adjustment: number;
}

/**
 * Check cross-file consistency for a given file and topic.
 *
 * Rules:
 * - Peers consistent + target matches: boost by CONSISTENCY_BOOST (capped at 1.0)
 * - Peers consistent + target deviates: reduce by DEVIATION_PENALTY
 * - Peers inconsistent: no adjustment, flag in report
 *
 * @param graph - The cross-file pattern graph
 * @param fileId - Target file identifier
 * @param topicSignature - The topic signature to check
 * @returns Consistency result with adjustment
 */
export function checkConsistency(
  graph: CrossFileGraph,
  fileId: string,
  topicSignature: string,
): ConsistencyResult {
  const fileEdges = graph.edges.get(fileId);

  if (!fileEdges) {
    return { peersConsistent: false, targetMatchesPeers: false, adjustment: 0 };
  }

  const peers = fileEdges.get(topicSignature);

  if (!peers || peers.length === 0) {
    // Target has no peers for this signature; check if other signatures have peers
    const hasAnyPeers = Array.from(fileEdges.values()).some((p) => p.length > 0);
    if (hasAnyPeers) {
      // Peers are consistent (they share a different signature) but target deviates
      return { peersConsistent: true, targetMatchesPeers: false, adjustment: -DEVIATION_PENALTY };
    }
    return { peersConsistent: false, targetMatchesPeers: false, adjustment: 0 };
  }

  // Target shares a signature with peers
  return { peersConsistent: true, targetMatchesPeers: true, adjustment: CONSISTENCY_BOOST };
}

/**
 * Apply a consistency adjustment to a compliance score.
 *
 * @param compliance - Base compliance score (0-1)
 * @param adjustment - Adjustment from consistency check
 * @returns Adjusted score, clamped to [0, 1]
 */
export function applyAdjustment(
  compliance: number,
  adjustment: number,
): number {
  return Math.max(0, Math.min(1, compliance + adjustment));
}

/**
 * Produce cross-file findings for a set of topics from the graph.
 *
 * Groups files into consistent and deviating sets per topic.
 *
 * @param graph - The cross-file pattern graph
 * @param fileVectors - All file vectors
 * @param topics - Topics to analyze
 * @returns Array of cross-file findings
 */
export function produceCrossFileFindings(
  graph: CrossFileGraph,
  fileVectors: Record<string, RawFileVector>,
  topics: PatternTopic[],
): CrossFileFinding[] {
  const findings: CrossFileFinding[] = [];

  for (const topic of topics) {
    const signatureGroups = new Map<string, string[]>();

    for (const [fileId, sigMap] of graph.edges) {
      for (const [signature, peers] of sigMap) {
        const group = signatureGroups.get(signature) ?? [];
        if (!group.includes(fileId)) {
          group.push(fileId);
        }
        for (const peer of peers) {
          if (!group.includes(peer)) {
            group.push(peer);
          }
        }
        signatureGroups.set(signature, group);
      }
    }

    for (const [signature, members] of signatureGroups) {
      if (members.length > 1) {
        const allFileIds = Object.keys(fileVectors);
        const deviating = allFileIds.filter(
          (id) => !members.includes(id) && graph.edges.has(id),
        );

        findings.push({
          topic,
          consistentFiles: members,
          deviatingFiles: deviating,
          signatureHash: signature,
        });
      }
    }
  }

  return findings;
}
