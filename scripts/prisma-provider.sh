#!/usr/bin/env bash
# Swaps the Prisma datasource provider between sqlite (zero-install dev)
# and postgresql (CI test / prod). See docs/specs/technical/01-architecture.md §5.
#
# Usage: scripts/prisma-provider.sh [sqlite|postgresql]
set -euo pipefail

provider="${1:?usage: prisma-provider.sh [sqlite|postgresql]}"
schema="$(dirname "$0")/../server/prisma/schema.prisma"

sed -i -E "s/provider = \"(sqlite|postgresql)\"/provider = \"${provider}\"/" "$schema"
echo "Prisma provider set to '${provider}' in ${schema}"
