#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

echo "🧹 Starting clean process..."

# Remove root node_modules and lockfile
echo "Removing root node_modules and pnpm-lock.yaml..."
rm -rf node_modules
rm -f pnpm-lock.yaml

# Remove node_modules from apps, packages, and tools
echo "Removing node_modules from workspace packages..."
# Use find for robustness, handle cases where directories might not exist
find apps packages tools -maxdepth 1 -mindepth 1 -type d -exec rm -rf {}/node_modules \; -print

# Optionally remove turbo cache
# echo "Removing .turbo cache..."
# rm -rf .turbo

echo "✅ Clean process completed."

echo "
📦 Installing dependencies..."
pnpm install 