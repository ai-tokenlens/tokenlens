# tklens-cli

Low-token CLI for TokenLens — no LLM calls, pure REST.

## Install

```bash
npm install -g @tokenlens/cli
# or
npx @tokenlens/cli <command>
```

## Quick start

```bash
npx @tokenlens/cli login --endpoint http://localhost:8080 --api-key <your-key>
tklens whoami
```

## Commands

```
tklens login --endpoint <url> --api-key <key>
tklens whoami
tklens search <query> [--tag <tag>] [--sort rating|efficiency|popular|new]
tklens info <skill-id>
tklens add <skill-id> [--target auto|claude-code|copilot]
tklens publish [path]
tklens pull <origin-url>
tklens rate <skill-id> --stars N [--comment "..."]
tklens collect [--tool copilot-cli|claude-code]
```

Config stored at `~/.tklens/config.json`.

## Dev

```bash
npm install
npm run build
./bin/run.js whoami
```
