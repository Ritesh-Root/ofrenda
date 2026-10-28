#!/usr/bin/env bash
# Creates the Hermes kanban board "ofrenda" with every build task, its brief, its skills and its
# dependencies. Idempotent: re-running returns the existing tasks (idempotency keys).
# Code tasks share one working directory and one git index, so they are chained one after another:
# at most one worker runs at a time. T16/T17 spend money and start blocked.
set -euo pipefail

REPO="$HOME/projects/ofrenda"
BOARD="ofrenda"
MODEL="deepseek-ai/DeepSeek-V4.1-Flash-1017"
PROVIDER="featherless"
ASSIGNEE="default"

cd "$REPO"
hermes kanban boards list | grep -qE "(^|[[:space:]])$BOARD([[:space:]]|$)" ||
  hermes kanban boards create "$BOARD" --name "Ofrenda" --default-workdir "$REPO" \
    --description "Hacktoberfest W4: local-first digital ofrenda" >/dev/null

# id, brief file, skills (comma separated), max runtime, initial status
TASKS=(
  "T01|T01-scaffold.md|incremental-implementation,source-driven-development|2h|"
  "T02|T02-core.md|test-driven-development,codebase-design,source-driven-development|4h|"
  "T03|T03-cli.md|frontend-ui-engineering,test-driven-development|3h|"
  "T04|T04-agent.md|source-driven-development,api-and-interface-design,test-driven-development|3h|"
  "T05|T05-voice.md|source-driven-development,security-and-hardening|2h|"
  "V1|V1-tier1-verify.md|verification-before-completion,code-review-and-quality|2h|"
  "T06|T06-temporal.md|source-driven-development,debugging-and-error-recovery|3h|"
  "T07|T07-sentry.md|observability-and-instrumentation,source-driven-development|2h|"
  "T08|T08-web-shell.md|design-taste-frontend,frontend-design,make-interfaces-feel-better|4h|"
  "T09|T09-web-features.md|frontend-ui-engineering,motion-design,web-design-guidelines|4h|"
  "T10|T10-auth.md|security-and-hardening,source-driven-development,test-driven-development|3h|"
  "T11|T11-serpapi.md|source-driven-development,security-and-hardening|2h|"
  "T12|T12-ci-render.md|ci-cd-and-automation,shipping-and-launch|2h|"
  "V2|V2-tier2-verify.md|verification-before-completion,webapp-testing,code-review-and-quality|3h|"
  "T13|T13-rescue.md|source-driven-development,browser-testing-with-devtools|3h|"
  "T14|T14-video.md|ai-narrated-video,product-video-script|3h|"
  "T15|T15-post.md|story-writer,writing-guidelines,documentation-and-adrs|2h|"
  "T16|T16-digitalocean.md|source-driven-development,shipping-and-launch|2h|blocked"
  "T17|T17-tinker.md|source-driven-development,test-driven-development|4h|blocked"
)

declare -A ID
prev=""
for row in "${TASKS[@]}"; do
  IFS='|' read -r key brief skills runtime status <<<"$row"
  title="$(head -1 "docs/tasks/$brief" | sed 's/^# //')"
  body="Workspace: $REPO. Read AGENTS.md first, then this brief (also at docs/tasks/$brief).
Rules that matter most: never git push or add a remote; never print secrets; complete only when the
Verify block passes and you pasted its real output as a comment.

$(cat "docs/tasks/$brief")"

  args=(kanban --board "$BOARD" create "$title" --body "$body" --assignee "$ASSIGNEE"
        --workspace "dir:$REPO" --max-runtime "$runtime" --max-retries 2
        --model "$MODEL" --provider "$PROVIDER" --idempotency-key "ofrenda-$key"
        --created-by claude --json)
  IFS=',' read -ra sk <<<"$skills"
  for s in "${sk[@]}"; do args+=(--skill "$s"); done
  case "$key" in
    T16|T17) args+=(--parent "${ID[V2]}") ;;
    *) [ -n "$prev" ] && args+=(--parent "$prev") ;;
  esac
  [ -n "$status" ] && args+=(--initial-status "$status")

  id="$(hermes "${args[@]}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')"
  ID[$key]="$id"
  case "$key" in T16|T17) ;; *) prev="$id" ;; esac
  printf '%-4s %s  %s\n' "$key" "$id" "$title"
done

echo
hermes kanban --board "$BOARD" list
