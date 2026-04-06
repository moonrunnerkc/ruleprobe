#!/usr/bin/env bash
# post-comment.sh
#
# Posts or updates a RuleProbe report as a PR comment. Called by the
# composite GitHub Action when post-comment is true and the trigger
# is a pull_request event.
#
# Uses a hidden marker comment (<!-- ruleprobe-report -->) to find
# and update existing comments instead of creating duplicates.
#
# Skips posting if there are zero violations and fail-on-violation
# is false (no noise on clean PRs).

set -euo pipefail

REPORT_FILE="${RULEPROBE_REPORT_FILE:-.ruleprobe-report.txt}"
FAIL_ON_VIOLATION="${INPUT_FAIL_ON_VIOLATION:-true}"

if [[ ! -f "${REPORT_FILE}" ]]; then
  echo "No report file found at ${REPORT_FILE}, skipping comment."
  exit 0
fi

report_content=$(cat "${REPORT_FILE}")
line_count=$(echo "${report_content}" | wc -l)

# Skip comment if zero violations and fail-on-violation is false
if [[ "${FAIL_ON_VIOLATION}" == "false" ]]; then
  if echo "${report_content}" | grep -q "| 0 failed |"; then
    echo "Zero violations and fail-on-violation is false. Skipping PR comment."
    exit 0
  fi
fi

# Determine PR number from the event
if [[ -z "${GITHUB_EVENT_PATH:-}" ]]; then
  echo "GITHUB_EVENT_PATH not set. Cannot determine PR number."
  exit 0
fi

pr_number=$(node -e "const e=JSON.parse(require('fs').readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));console.log(e.pull_request?.number ?? '')")

if [[ -z "${pr_number}" ]]; then
  echo "Could not determine PR number from event payload. Skipping comment."
  exit 0
fi

repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
api_url="${GITHUB_API_URL:-https://api.github.com}"
marker="<!-- ruleprobe-report -->"

# Wrap long reports in a collapsible block
if [[ ${line_count} -gt 20 ]]; then
  body="${marker}
## RuleProbe: Instruction Adherence Report

<details>
<summary>Click to expand full report (${line_count} lines)</summary>

\`\`\`
${report_content}
\`\`\`

</details>"
else
  body="${marker}
## RuleProbe: Instruction Adherence Report

\`\`\`
${report_content}
\`\`\`"
fi

# Look for an existing RuleProbe comment to update
existing_comment_id=$(curl -s \
  -H "Authorization: token ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github.v3+json" \
  "${api_url}/repos/${repo}/issues/${pr_number}/comments?per_page=100" \
  | node -e "
const data=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
const c=data.find(c=>c.body && c.body.includes('${marker}'));
console.log(c ? c.id : '');
" 2>/dev/null || echo "")

escaped_body=$(node -e "console.log(JSON.stringify(process.argv[1]))" -- "${body}")

if [[ -n "${existing_comment_id}" ]]; then
  echo "Updating existing RuleProbe comment (ID: ${existing_comment_id})"
  curl -s -X PATCH \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    "${api_url}/repos/${repo}/issues/comments/${existing_comment_id}" \
    -d "{\"body\": ${escaped_body}}" > /dev/null
else
  echo "Creating new RuleProbe comment on PR #${pr_number}"
  curl -s -X POST \
    -H "Authorization: token ${GITHUB_TOKEN}" \
    -H "Accept: application/vnd.github.v3+json" \
    "${api_url}/repos/${repo}/issues/${pr_number}/comments" \
    -d "{\"body\": ${escaped_body}}" > /dev/null
fi

echo "Comment posted successfully."
