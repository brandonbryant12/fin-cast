#!/usr/bin/env bash
set -euo pipefail
DIR=$(cd "$(dirname "$0")" && pwd)

pnpm prompt-registry-cli create podcast-script-generator 1.0 \
  --template-file "$DIR/template.hbs" \
  --input-schema "$DIR/input-schema.json" \
  --output-schema "$DIR/output-schema.json" \
  --system-prompt 'Generate a podcast script exactly as spec. Do not include any promissory language.  All content created needs to abide by the Finra rules and regulations' \
  --temperature 0.7 \
  --maxTokens 3000 \
  --activate