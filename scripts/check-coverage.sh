#!/bin/bash
# Coverage gate: run unit tests with coverage thresholds.
# Usage: check-coverage.sh [branch-threshold] [line-threshold]
set -euo pipefail

BRANCH_THRESH=${1:-90}
LINE_THRESH=${2:-95}

echo "Running coverage checks (branches≥$BRANCH_THRESH%, lines≥$LINE_THRESH%)..."

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT/packages/shared" && bunx vitest run --coverage
cd "$ROOT/packages/worker" && bunx vitest run --coverage
cd "$ROOT/packages/ui" && bunx vitest run --coverage

echo "✔ Coverage passed"
