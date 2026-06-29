#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function ok   { param($msg) Write-Host "✔  $msg" -ForegroundColor Green }
function warn { param($msg) Write-Host "⚠  $msg" -ForegroundColor Yellow }
function fail { param($msg) Write-Host "✖  $msg" -ForegroundColor Red; exit 1 }

# ── Check Docker ─────────────────────────────────────────────────────────────
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    fail "docker non trovato. Installa Docker Desktop: https://www.docker.com/products/docker-desktop/"
}
try { docker compose version | Out-Null } catch {
    fail "docker compose non trovato (richiede Docker Compose v2+). Aggiorna Docker Desktop."
}
try { docker info | Out-Null } catch {
    fail "Docker installato ma non in esecuzione. Avvia Docker Desktop e riprova."
}

# ── Check .env ───────────────────────────────────────────────────────────────
if (-not (Test-Path ".env")) {
    if (-not (Test-Path ".env.example")) {
        fail ".env.example non trovato. Assicurati di essere nella root del repository."
    }
    Copy-Item ".env.example" ".env"
    warn "Configura INGEST_TOKEN in .env prima di continuare."
    exit 1
}

# ── Check INGEST_TOKEN ───────────────────────────────────────────────────────
$tokenLine = (Get-Content ".env" | Where-Object { $_ -match '^INGEST_TOKEN=' } | Select-Object -First 1)
$ingestToken = if ($tokenLine) { ($tokenLine -replace '^INGEST_TOKEN=', '').Trim().Trim('"').Trim("'") } else { '' }

if (-not $ingestToken -or $ingestToken -eq 'change-me') {
    fail "Esegui scripts/generate-key.ps1 prima di avviare."
}

# ── Start ────────────────────────────────────────────────────────────────────
Write-Host "Avvio docker compose..."
docker compose up -d --build

# ── Health polling ───────────────────────────────────────────────────────────
$max = 30; $attempt = 0
Write-Host -NoNewline "Attesa server"
while ($true) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) { break }
    } catch { }
    Start-Sleep -Seconds 2
    $attempt++
    Write-Host -NoNewline "."
    if ($attempt -ge $max) {
        Write-Host ""
        Write-Host "Log server:" -ForegroundColor Yellow
        docker compose logs server
        fail "Server non risponde dopo $($max * 2)s."
    }
}
Write-Host ""

# ── Done ─────────────────────────────────────────────────────────────────────
$masked = $ingestToken.Substring(0, [Math]::Min(6, $ingestToken.Length)) + "…"
ok "TokenLens server attivo su http://localhost:8080"
Write-Host "   INGEST_TOKEN: $masked"
