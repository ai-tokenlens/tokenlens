# ─────────────────────────────────────────────────────────────
# TokenLens — Verify installation (Windows)
# ─────────────────────────────────────────────────────────────
$errors = 0
function Write-Ok   { param($m) Write-Host "  [OK] $m" -ForegroundColor Green  }
function Write-Fail { param($m) Write-Host "  [XX] $m" -ForegroundColor Red;   $script:errors++ }
function Write-Warn { param($m) Write-Host "  [!!] $m" -ForegroundColor Yellow }

Write-Host "`n  TokenLens — Verification`n" -ForegroundColor White

# Docker containers
$running = docker compose ps --status running 2>$null
if ($running -match "server")   { Write-Ok   "server container is running" }
else                             { Write-Fail "server container NOT running  -> run: docker compose up -d" }
if ($running -match "frontend") { Write-Ok   "frontend container is running" }
else                             { Write-Fail "frontend container NOT running -> run: docker compose up -d" }

# API
try {
  $r = Invoke-WebRequest -Uri "http://localhost:8080/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
  if ($r.StatusCode -eq 200) { Write-Ok "API responds at http://localhost:8080/health" }
  else { Write-Fail "API returned status $($r.StatusCode)" }
} catch { Write-Fail "API not responding at port 8080 -> check: docker compose logs server" }

# Frontend
try {
  $r = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
  Write-Ok "Dashboard accessible at http://localhost:3000"
} catch { Write-Fail "Dashboard not responding -> check: docker compose logs frontend" }

# tklens
if (Get-Command tklens -ErrorAction SilentlyContinue) {
  Write-Ok "tklens CLI installed"
  $whoami = tklens whoami 2>$null
  if ($whoami -match "endpoint") { Write-Ok "tklens is logged in" }
  else { Write-Warn "tklens not logged in -> run: tklens login --endpoint http://localhost:8080" }
} else { Write-Fail "tklens CLI not found -> run: npm install -g @tokenlens/cli" }

# OTel
if ($env:OTEL_EXPORTER_OTLP_ENDPOINT) {
  Write-Ok "OTel endpoint: $env:OTEL_EXPORTER_OTLP_ENDPOINT"
} else {
  Write-Warn "OTEL_EXPORTER_OTLP_ENDPOINT not set -> open a new terminal window"
}
if ($env:OTEL_EXPORTER_OTLP_HEADERS -match "Authorization=Bearer ") {
  Write-Ok "OTel auth header present"
} else {
  Write-Fail "OTEL_EXPORTER_OTLP_HEADERS missing or lacks Bearer token -> server will return 401 and drop all events"
}
if ($env:OTEL_EXPORTER_OTLP_PROTOCOL -eq "http/json") {
  Write-Ok "OTel protocol: http/json"
} else {
  Write-Warn "OTEL_EXPORTER_OTLP_PROTOCOL is '$env:OTEL_EXPORTER_OTLP_PROTOCOL' (expected http/json) -> server cannot parse protobuf"
}

# MCP server (optional — only checked if the mcp profile container is running)
$mcpRunning = docker compose ps --status running 2>$null | Select-String "mcp"
if ($mcpRunning) {
  try {
    $r = Invoke-WebRequest -Uri "http://localhost:8082/sse" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Ok "MCP server responding at http://localhost:8082/sse"
  } catch { Write-Fail "MCP container running but port 8082 not responding -> check: docker compose logs mcp" }
} else {
  Write-Warn "MCP server not started (optional) -> run: .\scripts\mcp-setup.ps1 -Transport http"
}

# Summary
Write-Host ""
if ($errors -eq 0) { Write-Host "  All checks passed. TokenLens is ready!" -ForegroundColor Green }
else               { Write-Host "  $errors check(s) failed. See messages above." -ForegroundColor Red; exit 1 }
Write-Host ""
