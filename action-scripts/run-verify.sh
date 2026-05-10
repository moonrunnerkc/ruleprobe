#!/usr/bin/env bash
# run-verify.sh
#
# Called by the RuleProbe composite GitHub Action. Runs ruleprobe verify
# with inputs provided via environment variables, captures outputs, and
# sets GitHub Actions output variables (score, passed, failed, total).
#
# Exit codes:
#   0 - all rules passed (or fail-on-violation is false)
#   1 - violations found and fail-on-violation is true
#   2 - execution error (file not found, parse failure, etc)

set -euo pipefail

RULEPROBE="${RULEPROBE_BIN:-node dist/cli.js}"
WORKSPACE="${GITHUB_WORKSPACE:-.}"
REPORT_FILE="${WORKSPACE}/.ruleprobe-report.txt"
JSON_FILE="${WORKSPACE}/.ruleprobe-report.json"
RDJSON_FILE="${WORKSPACE}/.ruleprobe-report.rdjson"

instruction_file="${INPUT_INSTRUCTION_FILE:?instruction-file input is required}"
output_dir="${INPUT_OUTPUT_DIR:-src}"
agent="${INPUT_AGENT:-ci}"
model="${INPUT_MODEL:-unknown}"
format="${INPUT_FORMAT:-text}"
severity="${INPUT_SEVERITY:-all}"
fail_on_violation="${INPUT_FAIL_ON_VIOLATION:-true}"
reviewdog_format="${INPUT_REVIEWDOG_FORMAT:-false}"
changed_since="${INPUT_CHANGED_SINCE:-}"

# ── Helper: build common verify args ──

build_verify_args() {
  local args=()
  args+=("${instruction_file}")
  args+=("${output_dir}")
  args+=(--agent "${agent}")
  args+=(--model "${model}")
  args+=(--severity "${severity}")
  if [[ -n "${changed_since}" ]]; then
    args+=(--changed-since "${changed_since}")
  fi
  printf '%s\n' "${args[@]}"
}

# ── Run the text report (saved for PR comments) ──

set +e
{
  build_verify_args
  echo "--format text"
} | xargs node "${RULEPROBE}" verify > "${REPORT_FILE}" 2>&1
text_exit=$?
set -e

if [[ ${text_exit} -eq 2 ]]; then
  echo "::error::RuleProbe execution error. Check the instruction file path and output directory."
  cat "${REPORT_FILE}"
  exit 2
fi

cat "${REPORT_FILE}"

# ── Run the JSON report (for programmatic consumption and output vars) ──

set +e
{
  build_verify_args
  echo "--format json"
} | xargs node "${RULEPROBE}" verify > "${JSON_FILE}" 2>&1
json_exit=$?
set -e

if [[ ${json_exit} -eq 2 ]]; then
  echo "::error::RuleProbe failed to produce JSON report."
  exit 2
fi

# ── Extract output variables from JSON ──

score=$(node -e "const r=JSON.parse(require('fs').readFileSync('${JSON_FILE}','utf8'));console.log(Math.round(r.summary.adherenceScore))")
passed=$(node -e "const r=JSON.parse(require('fs').readFileSync('${JSON_FILE}','utf8'));console.log(r.summary.passed)")
failed=$(node -e "const r=JSON.parse(require('fs').readFileSync('${JSON_FILE}','utf8'));console.log(r.summary.failed)")
total=$(node -e "const r=JSON.parse(require('fs').readFileSync('${JSON_FILE}','utf8'));console.log(r.summary.totalRules)")

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "score=${score}" >> "${GITHUB_OUTPUT}"
  echo "passed=${passed}" >> "${GITHUB_OUTPUT}"
  echo "failed=${failed}" >> "${GITHUB_OUTPUT}"
  echo "total=${total}" >> "${GITHUB_OUTPUT}"
fi

echo ""
echo "Score: ${score}% | Passed: ${passed} | Failed: ${failed} | Total: ${total}"

# ── Optionally produce rdjson output for reviewdog ──

if [[ "${reviewdog_format}" == "true" ]]; then
  set +e
  {
    build_verify_args
    echo "--format rdjson"
  } | xargs node "${RULEPROBE}" verify > "${RDJSON_FILE}" 2>&1
  rdjson_exit=$?
  set -e

  if [[ ${rdjson_exit} -ne 2 ]]; then
    echo "::notice::rdjson report written to ${RDJSON_FILE}"
  fi
fi

# ── Produce the user-requested format to stdout if different from text ──

if [[ "${format}" != "text" && "${format}" != "json" ]]; then
  echo ""
  echo "--- ${format} report ---"
  set +e
  {
    build_verify_args
    echo "--format ${format}"
  } | xargs node "${RULEPROBE}" verify
  set -e
fi

# ── Determine exit code ──

if [[ ${text_exit} -eq 1 && "${fail_on_violation}" == "true" ]]; then
  echo "::error::RuleProbe found ${failed} rule violation(s). Score: ${score}%"
  exit 1
fi

exit 0
