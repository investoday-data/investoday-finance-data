OWNER="investoday-data"
REPO="investoday-api-skills"
BRANCH="main"
WORKFLOW="update-references.yml"
GITHUB_TOKEN="ghp_你的Token粘贴在这里"

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW}/dispatches" \
  -d "{\"ref\":\"${BRANCH}\",\"inputs\":{\"triggered_by\":\"jenkins\"}}")

if [ "${HTTP_STATUS}" = "204" ]; then
  echo "✅ Workflow 触发成功"
else
  echo "❌ 触发失败: HTTP ${HTTP_STATUS}"
  exit 1
fi