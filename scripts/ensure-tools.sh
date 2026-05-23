#!/bin/sh
# Ensure required CLI tools are installed
require_tool() {
  local tool="$1" purpose="$2"
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "❌ $tool not found (needed for $purpose)" >&2
    echo "   Install: brew install $tool" >&2
    exit 1
  fi
}
