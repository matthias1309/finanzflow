#!/bin/sh
set -e

# Docker entrypoint for FinanzFlow
# Default environment (can be overridden via docker run -e or env files)
export NODE_ENV="${NODE_ENV:-production}"

# All other defaults are set in server/env-defaults.ts
exec node dist/index.cjs
