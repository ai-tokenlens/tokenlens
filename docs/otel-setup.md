# OpenTelemetry Setup Guide

TokenLens collects token usage via OTLP/HTTP (protobuf). The server listens on `POST /otel/v1/traces` and `POST /otel/v1/metrics`.

---

## GitHub Copilot CLI

### Required environment variables

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:8080/otel"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_SERVICE_NAME="copilot-cli"
export OTEL_RESOURCE_ATTRIBUTES="tokenlens.user=you@example.com"
```

Replace `you@example.com` with the email you want to appear in the dashboard.  
Replace `localhost:8080` with your server host if running remotely.

### What TokenLens reads from Copilot spans

The GenAI mapper (`server/otel/genai_mapper.py`) extracts:

| OTel attribute | TokenLens field |
|----------------|----------------|
| `gen_ai.usage.input_tokens` | `input_tokens` |
| `gen_ai.usage.output_tokens` | `output_tokens` |
| `gen_ai.usage.cache_read_input_tokens` | `cache_read_tokens` |
| `gen_ai.usage.cache_creation_input_tokens` | `cache_write_tokens` |
| `gen_ai.request.model` | `model` |
| `tokenlens.user` (resource attr) | `user_id` |

Copilot emits an `invoke_agent` root span with `chat` and `execute_tool` children. Token counts are on the `chat` spans.

---

## Claude Code

### Required environment variables

```bash
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:8080/otel"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_RESOURCE_ATTRIBUTES="tokenlens.user=you@example.com"
```

`CLAUDE_CODE_ENABLE_TELEMETRY=1` activates OTel export inside Claude Code. Without it the other vars have no effect.

---

## Making variables persistent

### macOS / Linux — bash

Add to `~/.bash_profile` or `~/.bashrc`:

```bash
# TokenLens OTel — Copilot CLI
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:8080/otel"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_SERVICE_NAME="copilot-cli"
export OTEL_RESOURCE_ATTRIBUTES="tokenlens.user=you@example.com"

# TokenLens OTel — Claude Code (adds to existing OTEL_* above)
export CLAUDE_CODE_ENABLE_TELEMETRY=1
```

Then reload: `source ~/.bash_profile`

### macOS / Linux — zsh

Add to `~/.zshrc`:

```zsh
# TokenLens OTel
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:8080/otel"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_SERVICE_NAME="copilot-cli"
export OTEL_RESOURCE_ATTRIBUTES="tokenlens.user=you@example.com"
export CLAUDE_CODE_ENABLE_TELEMETRY=1
```

Then reload: `source ~/.zshrc`

### macOS — launchd (system-wide, survives reboots, affects GUI apps)

Create `~/Library/LaunchAgents/com.tokenlens.otel.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.tokenlens.otel</string>
  <key>ProgramArguments</key>
  <array><string>/bin/launchctl</string><string>setenv</string>
    <string>OTEL_EXPORTER_OTLP_ENDPOINT</string>
    <string>http://localhost:8080/otel</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
</dict>
</plist>
```

Repeat for each variable. Load with `launchctl load ~/Library/LaunchAgents/com.tokenlens.otel.plist`, then log out and back in.

### Linux — systemd user environment

```bash
systemctl --user import-environment OTEL_EXPORTER_OTLP_ENDPOINT \
  OTEL_EXPORTER_OTLP_PROTOCOL OTEL_SERVICE_NAME \
  OTEL_RESOURCE_ATTRIBUTES CLAUDE_CODE_ENABLE_TELEMETRY
```

Or set them persistently in `~/.config/environment.d/tokenlens.conf`:

```ini
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:8080/otel
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_SERVICE_NAME=copilot-cli
OTEL_RESOURCE_ATTRIBUTES=tokenlens.user=you@example.com
CLAUDE_CODE_ENABLE_TELEMETRY=1
```

### Windows — PowerShell profile

Add to `$PROFILE` (usually `~\Documents\PowerShell\Microsoft.PowerShell_profile.ps1`):

```powershell
$env:OTEL_EXPORTER_OTLP_ENDPOINT    = "http://localhost:8080/otel"
$env:OTEL_EXPORTER_OTLP_PROTOCOL    = "http/protobuf"
$env:OTEL_SERVICE_NAME               = "copilot-cli"
$env:OTEL_RESOURCE_ATTRIBUTES        = "tokenlens.user=you@example.com"
$env:CLAUDE_CODE_ENABLE_TELEMETRY    = "1"
```

Or set them system-wide via **System Properties → Environment Variables**.

---

## Fallback: session-file collector

If OTel is not available, use `tklens collect` to scrape local session files:

```bash
# Auto-detect tool, send all events found
tklens collect

# Single tool, only events after a date
tklens collect --tool claude-code --since 2026-06-01T00:00:00Z

# Preview without sending
tklens collect --output json
```

Claude Code session files: `~/.claude/**/*.jsonl`  
Copilot session files: VS Code workspace/global storage JSON (platform-specific paths auto-detected)

> Token counts from session-file parsing are **estimates** (`source=session-file` in the DB), not exact. OTel is the authoritative source.

---

## Verifying the connection

```bash
# Should return {"status":"ok"}
curl http://localhost:8080/health

# Send a test OTLP payload (requires grpcurl or a test script)
# Alternatively, run the tool once and check the dashboard
```

Check the server logs for lines like `[otel] accepted N spans` to confirm ingest is working.
