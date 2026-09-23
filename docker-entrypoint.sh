#!/bin/sh
set -e

# Docker entrypoint for FinanzFlow
# NODE_ENV is handled by server/env-defaults.ts based on DOCKER_DEPLOY
# Allow explicit override via NODE_ENV_EXPLICIT if needed
if [ -n "$NODE_ENV_EXPLICIT" ]; then
  export NODE_ENV="$NODE_ENV_EXPLICIT"
fi

exec node dist/index.cjs
