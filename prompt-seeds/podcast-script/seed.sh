#!/usr/bin/env bash
set -euo pipefail
DIR=$(cd "$(dirname "$0")" && pwd)

pnpm prompt-registry-cli create podcast-script-generator 1.0 \
  --template-file "$DIR/template.hbs" \
  --input-schema "$DIR/input-schema.json" \
  --output-schema "$DIR/output-schema.json" \
  --instructions 'Generate a podcast script exactly as spec.' \
  --temperature 0.7 \
  --maxTokens 3000 \
  --activate