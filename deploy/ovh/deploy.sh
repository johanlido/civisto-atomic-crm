#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

if [ ! -f .env ]; then
  echo "Saknar deploy/ovh/.env. Kopiera .env.example och fyll i värdena." >&2
  exit 1
fi

chmod 600 .env

for command in docker openssl; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Kommandot '$command' saknas." >&2
    exit 1
  fi
done

set -a
# shellcheck disable=SC1091
. ./.env
set +a

required_variables="CRM_DOMAIN API_DOMAIN MCP_DOMAIN ACME_EMAIL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY MCP_API_KEY"
for variable in $required_variables; do
  eval "value=\${$variable:-}"
  if [ -z "$value" ]; then
    echo "Miljövariabeln $variable saknas." >&2
    exit 1
  fi
done

if [ "${#MCP_API_KEY}" -lt 32 ]; then
  echo "MCP_API_KEY måste vara minst 32 tecken." >&2
  exit 1
fi

docker compose pull --ignore-buildable
docker compose build --pull
docker compose up -d --remove-orphans --wait

docker compose ps

echo "Deployment klar. Kontrollera:"
echo "  https://$CRM_DOMAIN/health"
echo "  https://$MCP_DOMAIN/health"
