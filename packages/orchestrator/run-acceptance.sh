#!/usr/bin/env bash
# Cutline Methods acceptance runner
#   ./packages/orchestrator/run-acceptance.sh           # full 21
#   ./packages/orchestrator/run-acceptance.sh --gate    # blessed n=6
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
exec npx --yes tsx packages/orchestrator/runAcceptance.ts "$@"
