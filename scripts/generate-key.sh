#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env"

TOKEN=$(openssl rand -base64 32 | tr -d '=+/' | head -c 43)

if grep -q '^INGEST_TOKEN=' "$ENV_FILE" 2>/dev/null; then
  read -r -p "INGEST_TOKEN già presente in .env. Sovrascrivere? [y/N] " ans
  case "$ans" in
    [yY]) ;;
    *) echo "Annullato."; exit 0 ;;
  esac
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s|^INGEST_TOKEN=.*|INGEST_TOKEN=${TOKEN}|" "$ENV_FILE"
  else
    sed -i "s|^INGEST_TOKEN=.*|INGEST_TOKEN=${TOKEN}|" "$ENV_FILE"
  fi
else
  printf '\nINGEST_TOKEN=%s\n' "$TOKEN" >> "$ENV_FILE"
fi

echo "✔ INGEST_TOKEN generato e salvato in .env"
echo "Chiave: ${TOKEN}"
echo "Conservala — non verrà mostrata di nuovo."
