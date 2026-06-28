# ─────────────────────────────────────────────────────────────
# TokenLens — Setup script for Windows
# Requires: PowerShell 5.1+ or PowerShell 7+
# Run as: Right-click → "Run with PowerShell" 
#         OR from terminal: .\scripts\setup-windows.ps1
# ─────────────────────────────────────────────────────────────
#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Helpers ───────────────────────────────────────────────────
function Write-Ok   { param($msg) Write-Host "  [OK] $msg"   -ForegroundColor Green  }
function Write-Info { param($msg) Write-Host "  [..] $msg"   -ForegroundColor Cyan   }
function Write-Warn { param($msg) Write-Host "  [!!] $msg"   -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "  [XX] $msg`n" -ForegroundColor Red; exit 1 }
function Write-Step { param($msg) Write-Host "`n── $msg ──────────────────────────────" -ForegroundColor White }

function Test-Command { param($cmd) return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

function Read-Input {
  param([string]$prompt, [string]$default = "")
  $display = if ($default) { "$prompt [$default]" } else { $prompt }
  $val = Read-Host "  $display"
  if ([string]::IsNullOrWhiteSpace($val)) { return $default }
  return $val
}

function Set-UserEnvVar {
  param([string]$name, [string]$value)
  [System.Environment]::SetEnvironmentVariable($name, $value, "User")
  Set-Item "Env:\$name" $value -ErrorAction SilentlyContinue
}

# ── Banner ────────────────────────────────────────────────────
Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║   TokenLens — Windows Setup          ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "  This script will:"
Write-Host "  1. Check prerequisites (Docker, Node, Git)"
Write-Host "  2. Configure TokenLens environment"
Write-Host "  3. Start the TokenLens server"
Write-Host "  4. Install the tklens CLI"
Write-Host "  5. Set environment variables for your AI tool"
Write-Host ""
Read-Host "  Press Enter to continue (Ctrl+C to cancel)"

# ══════════════════════════════════════════════════════════════
Write-Step "1 / 5 — Checking prerequisites"
# ══════════════════════════════════════════════════════════════

# Git
if (-not (Test-Command "git")) {
  Write-Info "Git not found. Attempting install via winget..."
  if (Test-Command "winget") {
    winget install --id Git.Git -e --source winget --silent
    $env:PATH += ";C:\Program Files\Git\cmd"
  } else {
    Write-Fail "Git not found and winget is unavailable.`nPlease install Git from https://git-scm.com/download/win and re-run this script."
  }
}
Write-Ok "Git $(git --version)"

# Docker
if (-not (Test-Command "docker")) {
  Write-Fail "Docker Desktop not found.`nPlease install it from https://www.docker.com/products/docker-desktop/`nEnable WSL2 integration during setup, then re-run this script."
}
try {
  $null = docker info 2>&1
  if ($LASTEXITCODE -ne 0) { throw }
} catch {
  Write-Fail "Docker is installed but not running.`nPlease start Docker Desktop and re-run this script."
}
Write-Ok "Docker $(docker --version)"

# Docker Compose v2
try {
  $null = docker compose version 2>&1
  if ($LASTEXITCODE -ne 0) { throw }
} catch {
  Write-Fail "Docker Compose v2 not found.`nMake sure Docker Desktop is up to date (it includes Compose v2)."
}
Write-Ok "Docker Compose $(docker compose version)"

# Node 20+
if (-not (Test-Command "node")) {
  Write-Info "Node.js not found. Installing via winget..."
  if (Test-Command "winget") {
    winget install OpenJS.NodeJS.LTS --silent
    $env:PATH += ";$env:PROGRAMFILES\nodejs"
  } else {
    Write-Fail "Node.js not found.`nPlease install Node 20 from https://nodejs.org and re-run this script."
  }
}
$nodeVersion = node -e "process.stdout.write(process.versions.node.split('.')[0])"
if ([int]$nodeVersion -lt 20) {
  Write-Fail "Node $($nodeVersion) found, but Node 20+ is required.`nVisit https://nodejs.org to update."
}
Write-Ok "Node $(node --version)"

# ══════════════════════════════════════════════════════════════
Write-Step "2 / 5 — Configuring TokenLens"
# ══════════════════════════════════════════════════════════════

if (-not (Test-Path "SPEC.md")) {
  Write-Fail "Run this script from the root of the tokenlens repository.`nExample: cd C:\projects\tokenlens; .\scripts\setup-windows.ps1"
}

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Ok "Created .env from .env.example"
} else {
  Write-Ok ".env already exists — skipping"
}

Write-Host ""
Write-Host "  Let's configure your TokenLens instance." -ForegroundColor White
Write-Host "  Press Enter to accept the default value shown in [brackets]."
Write-Host ""

$UserEmail  = Read-Input "Your email (used to identify you in the dashboard)" "user@example.com"

# Read and update INGEST_TOKEN
$envContent   = Get-Content ".env" -Raw
$currentToken = if ($envContent -match 'INGEST_TOKEN=(.+)') { $Matches[1].Trim() } else { "change-me" }

if ($currentToken -eq "change-me" -or [string]::IsNullOrWhiteSpace($currentToken)) {
  $IngestToken = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
  $envContent  = $envContent -replace 'INGEST_TOKEN=.*', "INGEST_TOKEN=$IngestToken"
  Set-Content ".env" $envContent
  Write-Ok "Generated a secure INGEST_TOKEN"
} else {
  $IngestToken = $currentToken
  Write-Ok "Existing INGEST_TOKEN kept"
}

# ══════════════════════════════════════════════════════════════
Write-Step "3 / 5 — Starting TokenLens server"
# ══════════════════════════════════════════════════════════════

Write-Info "Running docker compose up --build -d ..."
docker compose up --build -d
if ($LASTEXITCODE -ne 0) { Write-Fail "docker compose failed. Run 'docker compose logs' for details." }

Write-Info "Waiting for server to be ready..."
$maxWait = 60; $waited = 0
while ($waited -lt $maxWait) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($r.StatusCode -eq 200) { break }
  } catch {}
  Start-Sleep -Seconds 2; $waited += 2; Write-Host -NoNewline "."
}
if ($waited -ge $maxWait) {
  Write-Fail "Server did not start within ${maxWait}s.`nCheck logs: docker compose logs server"
}
Write-Host ""
Write-Ok "Server is up  → http://localhost:8080"
Write-Ok "Dashboard     → http://localhost:3000"

# ══════════════════════════════════════════════════════════════
Write-Step "4 / 5 — Installing tklens CLI"
# ══════════════════════════════════════════════════════════════

$cliDir = Join-Path $PSScriptRoot "..\tklens-cli"
$cliDir = (Resolve-Path $cliDir).Path
Write-Info "Building tklens CLI from $cliDir ..."
Push-Location $cliDir
npm install
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Fail "npm install (deps) failed in tklens-cli." }
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Fail "npm run build failed in tklens-cli." }
Pop-Location
npm install -g $cliDir
if ($LASTEXITCODE -ne 0) { Write-Fail "npm install -g failed. Check your Node/npm installation." }

tklens login --endpoint "http://localhost:8080" --api-key $IngestToken
Write-Ok "tklens CLI installed and logged in as $UserEmail"

# ══════════════════════════════════════════════════════════════
Write-Step "5 / 5 — Setting AI tool environment variables"
# ══════════════════════════════════════════════════════════════

# Set as permanent User-level environment variables (survive reboots and new terminals)
Set-UserEnvVar "TOKENLENS_USER"                  $UserEmail
Set-UserEnvVar "OTEL_EXPORTER_OTLP_ENDPOINT"     "http://localhost:8080/otel"
Set-UserEnvVar "OTEL_EXPORTER_OTLP_PROTOCOL"     "http/protobuf"
Set-UserEnvVar "OTEL_RESOURCE_ATTRIBUTES"         "tokenlens.user=$UserEmail"
Set-UserEnvVar "OTEL_SERVICE_NAME"                "copilot-cli"
Set-UserEnvVar "CLAUDE_CODE_ENABLE_TELEMETRY"     "1"

Write-Ok "OTel variables set as permanent User environment variables"
Write-Warn "Open a new PowerShell or Command Prompt window for the variables to take effect."

# ══════════════════════════════════════════════════════════════
Write-Host ""
Write-Host "  ✔  TokenLens setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard  →  http://localhost:3000"
Write-Host "  API        →  http://localhost:8080"
Write-Host "  Your ID    →  $UserEmail"
Write-Host ""
Write-Host "  Next steps:"
Write-Host "  1. Open a new terminal window"
Write-Host "  2. Use Copilot CLI or Claude Code as usual"
Write-Host "  3. Open the dashboard to see token usage appear"
Write-Host "  4. Try:  tklens search mulesoft"
Write-Host ""
Write-Host "  To verify:  .\scripts\verify.ps1"
Write-Host ""
