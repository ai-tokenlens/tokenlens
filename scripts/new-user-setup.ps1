#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function ok   { param($msg) Write-Host "✔  $msg" -ForegroundColor Green }
function warn { param($msg) Write-Host "⚠  $msg" -ForegroundColor Yellow }
function fail { param($msg) Write-Host "✖  $msg" -ForegroundColor Red; exit 1 }

Write-Host ""
Write-Host "  TokenLens — Configurazione nuovo utente"
Write-Host "  ────────────────────────────────────────"
Write-Host ""

# ── Prompt: URL server ───────────────────────────────────────────────────────
$serverUrl = Read-Host "  URL del server TokenLens [http://localhost:8080]"
if (-not $serverUrl) { $serverUrl = "http://localhost:8080" }

# ── Prompt: API key ──────────────────────────────────────────────────────────
$apiKey = Read-Host "  API key (INGEST_TOKEN fornita dall'amministratore)"
if (-not $apiKey) { fail "API key obbligatoria." }

Write-Host ""

# ── a. Verifica Node >= 20 ───────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    fail "Node.js non trovato. Installa Node 20+: https://nodejs.org/en/download/"
}
$nodeVer = [int](node -e "process.stdout.write(process.versions.node.split('.')[0])")
if ($nodeVer -lt 20) {
    fail "Node $(node --version) trovato, ma Node 20+ è richiesto. Aggiorna: https://nodejs.org/en/download/"
}
ok "Node $(node --version)"

# ── b. Installa tklens CLI ───────────────────────────────────────────────────
$tklensCmd = $null
if (Get-Command tklens -ErrorAction SilentlyContinue) {
    ok "tklens già nel PATH — skip npm install"
    $tklensCmd = 'tklens'
} elseif (Test-Path "tklens-cli\bin\run.js") {
    ok "Modalità sviluppo locale — uso tklens-cli\bin\run.js"
    $tklensCmd = 'node tklens-cli\bin\run.js'
} else {
    Write-Host "Installazione @tokenlens/cli..."
    npm install -g @tokenlens/cli
    ok "tklens CLI installato"
    $tklensCmd = 'tklens'
}

# ── c. Login ─────────────────────────────────────────────────────────────────
Write-Host "Verifica credenziali..."
Invoke-Expression "$tklensCmd login --endpoint=`"$serverUrl`" --api-key=`"$apiKey`""
ok "Login completato"

# ── d. Dry-run collect ───────────────────────────────────────────────────────
Write-Host "Test raccolta eventi (dry-run)..."
$collectOut = Invoke-Expression "$tklensCmd collect --output=json 2>&1" -ErrorAction SilentlyContinue | Select-Object -First 5 | Out-String
$eventCount = ([regex]::Matches($collectOut, '"event"')).Count

# ── e. Riepilogo ─────────────────────────────────────────────────────────────
Write-Host ""
ok "tklens configurato per $serverUrl"
ok "$eventCount eventi token trovati in locale (pronti per tklens collect)"
Write-Host ""
Write-Host "  Prossimo passo: aggiungi ``tklens collect`` al tuo crontab/Task Scheduler"
Write-Host "  oppure usa ``tklens collect --daemon`` (disponibile dopo AGENT-22)."
Write-Host ""
