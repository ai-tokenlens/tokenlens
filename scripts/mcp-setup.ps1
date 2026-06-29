# ─────────────────────────────────────────────────────────────
# TokenLens — MCP server setup (Windows / PowerShell 5.1+)
#
# Usage:
#   .\scripts\mcp-setup.ps1                      # stdio -> Claude Code
#   .\scripts\mcp-setup.ps1 -Transport http      # HTTP/SSE -> Copilot / remote agents
# ─────────────────────────────────────────────────────────────
param(
  [ValidateSet("stdio", "http")]
  [string]$Transport = "stdio"
)

function Write-Ok   { param($m) Write-Host "  [OK] $m" -ForegroundColor Green  }
function Write-Fail { param($m) Write-Host "  [XX] $m" -ForegroundColor Red; exit 1 }
function Write-Info { param($m) Write-Host "  [->] $m" -ForegroundColor Yellow }

$RootDir     = Split-Path $PSScriptRoot -Parent
$McpDir      = Join-Path $RootDir "mcp-server"
$TklensConfig = Join-Path $env:USERPROFILE ".tklens\config.json"

Write-Host "`n  TokenLens — MCP Server Setup ($Transport)`n" -ForegroundColor White

# Read a field from ~/.tklens/config.json
function Get-TklensValue {
  param([string]$Key)
  try {
    $c = Get-Content $TklensConfig -Raw -ErrorAction Stop | ConvertFrom-Json
    $val = $c.$Key
    if ($null -ne $val) { return [string]$val } else { return "" }
  } catch { return "" }
}

$Endpoint = Get-TklensValue "endpoint"
if (-not $Endpoint) { $Endpoint = "http://localhost:8080" }
$ApiKey  = Get-TklensValue "apiKey"
$UserId  = Get-TklensValue "userId"

# ─── stdio (Claude Code) ───────────────────────────────────────
if ($Transport -eq "stdio") {
  Write-Info "Building mcp-server..."
  Push-Location $McpDir
  npm install --silent 2>$null | Out-Null
  npm run build 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) {
    Pop-Location
    Write-Fail "mcp-server build failed. Run 'npm run build' in mcp-server\ for details."
  }
  Pop-Location
  Write-Ok "mcp-server built -> $McpDir\dist\index.js"

  $ClaudeDir    = Join-Path $env:USERPROFILE ".claude"
  $ClaudeConfig = Join-Path $ClaudeDir "claude_desktop_config.json"
  if (-not (Test-Path $ClaudeDir)) { New-Item -ItemType Directory -Force $ClaudeDir | Out-Null }
  if (Test-Path $ClaudeConfig) {
    Copy-Item $ClaudeConfig "$ClaudeConfig.bak" -Force
    Write-Info "Backup: $ClaudeConfig.bak"
  }

  # Read existing config
  if (Test-Path $ClaudeConfig) {
    try { $cfgObj = Get-Content $ClaudeConfig -Raw | ConvertFrom-Json }
    catch { $cfgObj = New-Object PSObject }
  } else { $cfgObj = New-Object PSObject }

  # Ensure mcpServers exists
  if (-not ($cfgObj.PSObject.Properties.Name -contains "mcpServers")) {
    $cfgObj | Add-Member -NotePropertyName "mcpServers" -NotePropertyValue (New-Object PSObject)
  }

  # Build env and entry objects
  $envObj = New-Object PSObject
  $envObj | Add-Member -NotePropertyName "TOKENLENS_ENDPOINT"      -NotePropertyValue $Endpoint
  $envObj | Add-Member -NotePropertyName "TOKENLENS_API_KEY"       -NotePropertyValue $ApiKey
  $envObj | Add-Member -NotePropertyName "TOKENLENS_USER"          -NotePropertyValue $UserId
  $envObj | Add-Member -NotePropertyName "TOKENLENS_MCP_TRANSPORT" -NotePropertyValue "stdio"

  $entryObj = New-Object PSObject
  $entryObj | Add-Member -NotePropertyName "command" -NotePropertyValue "node"
  $entryObj | Add-Member -NotePropertyName "args"    -NotePropertyValue @("$McpDir\dist\index.js")
  $entryObj | Add-Member -NotePropertyName "env"     -NotePropertyValue $envObj

  $cfgObj.mcpServers | Add-Member -NotePropertyName "tokenlens" -NotePropertyValue $entryObj -Force

  $json = $cfgObj | ConvertTo-Json -Depth 10
  [System.IO.File]::WriteAllText($ClaudeConfig, $json, [System.Text.Encoding]::UTF8)

  Write-Ok "Scritto in $ClaudeConfig"
  Write-Host ""
  Write-Host "  Prossimo passo: riavvia Claude Code per caricare il server MCP." -ForegroundColor White
  Write-Host "  Verifica config: tklens mcp-setup --show-current"
  Write-Host ""

# ─── http (Copilot / remote agents) ───────────────────────────
} elseif ($Transport -eq "http") {
  Write-Info "Avvio container MCP via Docker..."
  Push-Location $RootDir
  docker compose --profile mcp up -d
  if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Fail "docker compose --profile mcp up -d fallito" }
  Pop-Location
  $McpPort = if ($env:TOKENLENS_MCP_PORT) { $env:TOKENLENS_MCP_PORT } else { "8082" }
  Write-Ok "Container MCP avviato su porta $McpPort"

  Write-Info "Scrittura .copilot/mcp.json nella directory corrente..."
  tklens mcp-setup --transport=http --apply
  if ($LASTEXITCODE -ne 0) { Write-Fail "'tklens mcp-setup --transport=http --apply' fallito" }
  Write-Ok "Copilot config aggiornata (.copilot/mcp.json)"

  Write-Host ""
  Write-Host "  MCP SSE endpoint: http://localhost:$McpPort/sse" -ForegroundColor White
  Write-Host "  Test: Invoke-WebRequest -Uri http://localhost:$McpPort/sse -TimeoutSec 5"
  Write-Host "  Per dettagli: docs\mcp-setup.md"
  Write-Host ""
}
