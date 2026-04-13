/**
 * HTTP client for the ruleprobe semantic API service.
 *
 * Sends RawExtractionPayload to the API, receives SemanticVerdict[] back.
 * Handles license validation, graceful degradation on network failure,
 * timeout, and retry. No raw source code ever appears in any request.
 */

import type {
  RawExtractionPayload,
  SemanticVerdict,
  SemanticAnalysisConfig,
  SemanticAnalysisReport,
} from './types.js';

/**
 * HTTP request timeout in milliseconds.
 * Analysis of large codebases may produce sizable payloads;
 * 120 seconds covers monorepos with 10k+ file vectors.
 */
const REQUEST_TIMEOUT_MS = 120_000;

/**
 * Number of retries for transient network failures.
 * One retry balances reliability with user wait time.
 */
const MAX_RETRIES = 1;

/**
 * Delay between retries in milliseconds.
 * Short delay to avoid blocking CI pipelines.
 */
const RETRY_DELAY_MS = 1000;

/** Response from the license validation endpoint. */
export interface LicenseValidationResponse {
  valid: boolean;
  tier: string;
  callsRemaining: number;
}

/** Response from the analyze endpoint. */
export interface AnalyzeResponse {
  verdicts: SemanticVerdict[];
  report: SemanticAnalysisReport;
}

/** Error returned when the API rejects a request. */
export interface ApiError {
  error: string;
  code: string;
}

/**
 * Validate a license key against the API service.
 *
 * @param config - Semantic analysis configuration with API endpoint and key
 * @returns Validation result, or null if the API is unreachable
 */
export async function validateLicense(
  config: SemanticAnalysisConfig,
): Promise<LicenseValidationResponse | null> {
  const url = `${config.apiEndpoint}/v1/validate`;
  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: config.licenseKey }),
    });

    if (!response.ok) {
      return null;
    }

    const data: unknown = await response.json();
    return data as LicenseValidationResponse;
  } catch {
    return null;
  }
}

/**
 * Send a raw extraction payload to the API for semantic analysis.
 *
 * Retries once on transient failure. Returns null on persistent failure
 * (graceful degradation: deterministic analysis continues without semantic).
 *
 * @param config - Semantic analysis configuration
 * @param payload - Raw extraction payload (opaque vectors only, no source code)
 * @returns Analysis response, or null if the API is unreachable
 */
export async function analyzeRemote(
  config: SemanticAnalysisConfig,
  payload: RawExtractionPayload,
): Promise<AnalyzeResponse | null> {
  const url = `${config.apiEndpoint}/v1/analyze`;
  const body = JSON.stringify({
    payload,
    licenseKey: config.licenseKey,
    maxLlmCalls: config.maxLlmCalls,
    useCache: config.useCache,
    fastPathThreshold: config.fastPathThreshold,
  });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          await delay(RETRY_DELAY_MS);
          continue;
        }
        return null;
      }

      const data: unknown = await response.json();
      return data as AnalyzeResponse;
    } catch {
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS);
        continue;
      }
      return null;
    }
  }

  return null;
}

/**
 * Fetch with a timeout using AbortController.
 *
 * @param url - Request URL
 * @param init - Fetch options
 * @returns Fetch response
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Delay execution for a given duration.
 *
 * @param ms - Milliseconds to wait
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
