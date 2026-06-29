# TokenLens — Agent Prompts

Copia il prompt della sessione corrente in Claude Code. Ogni sessione inizia pulita
(`/clear` o nuovo avvio). Committa dopo ogni agente prima di partire col successivo.

---

## FASE 1 — Foundation (indipendenti, eseguibili in sequenza)

### AGENT-01 · Server scaffold + modelli + Alembic
```
Implementa AGENT-01 di TokenLens.
Leggi SPEC.md §5 (data models) e §6.1.6 (project structure).
Crea l'intera struttura di cartelle del modulo `server/` con:
- main.py (FastAPI app, CORS, health check su GET /health)
- config.py (Settings via pydantic-settings: DATABASE_URL, INGEST_TOKEN, BLOB_DIR)
- database.py (SQLAlchemy engine + get_db dependency)
- models/ con un file per entità: usage_event.py, skill.py, skill_version.py, skill_rating.py, user.py
- migrations/ Alembic configurato per generare le tabelle da questi modelli
- requirements.txt con tutte le dipendenze necessarie
- Dockerfile (python:3.11-slim, uvicorn su porta 8080)
- tests/ con un test_health.py che verifica GET /health → 200

Al termine: riepilogo di 3 righe su cosa hai creato e quali TODO hai lasciato. Poi fermati.
```

---

### AGENT-02 · Frontend scaffold
```
Implementa AGENT-02 di TokenLens.
Leggi SPEC.md §6.3 (frontend structure e routes).
Crea l'intera struttura di `frontend/` con:
- progetto Vite + React 18 + Tailwind CSS + React Query
- src/api/client.js: istanza axios con baseURL da VITE_API_BASE_URL, più hooks useAnalyticsSummary, useSkills, useRecommendations (tutti con mock data hardcoded per ora)
- pages/ con file vuoti ma routati: Dashboard.jsx, UserDetail.jsx, SkillBrowser.jsx, SkillDetail.jsx, SkillEditor.jsx
- components/layout/Sidebar.jsx e Header.jsx funzionanti con navigazione tra le 5 route
- App.jsx con React Router che monta tutte le route
- index.html, vite.config.js, tailwind.config.js
- Dockerfile (node:20-alpine, build + serve su porta 3000)

L'app deve avviarsi con `npm run dev` senza errori. Ogni page mostra almeno il suo titolo.
Al termine: 3 righe di riepilogo, poi fermati.
```

---

### AGENT-03 · tklens-cli scaffold
```
Implementa AGENT-03 di TokenLens.
Leggi SPEC.md §6.2 (tklens-cli structure e comandi).
Crea `tklens-cli/` con:
- progetto oclif (TypeScript, Node 20)
- src/commands/ con file stub per: login.ts, search.ts, info.ts, add.ts, publish.ts, pull.ts, rate.ts, collect.ts, whoami.ts — ogni comando stampa "Not yet implemented: <nome>" e ritorna senza errori
- src/lib/config.ts: legge/scrive ~/.tklens/config.json (endpoint, apiKey, userId)
- src/lib/apiClient.ts: classe con metodo get/post verso l'endpoint configurato
- login.ts REALE: accetta --endpoint e --api-key, salva in config, stampa "Logged in to <endpoint>"
- whoami.ts REALE: legge config e stampa userId + endpoint, o "Not logged in"
- package.json con bin: { "tklens": "./bin/run.js" }
- tsconfig.json, README.md con `npx @tokenlens/cli login --endpoint http://localhost:8080`

Deve compilare con `npm run build` senza errori. `tklens login` e `tklens whoami` devono funzionare.
Al termine: 3 righe di riepilogo, poi fermati.
```

---

## FASE 2 — Collection & Registry core (in ordine)

### AGENT-04 · OTel receiver + GenAI mapper
*Dipende da: AGENT-01 completato e committato*
```
Implementa AGENT-04 di TokenLens.
Leggi SPEC.md §4 (token collection design) e §6.1.1 (OTel ingest endpoints).
Nel modulo `server/` aggiungi:
- otel/receiver.py: riceve POST /otel/v1/traces e POST /otel/v1/metrics in formato OTLP/HTTP JSON; valida l'header Authorization Bearer contro settings.INGEST_TOKEN
- otel/genai_mapper.py: estrae dagli span OTLP gli attributi GenAI (gen_ai.usage.input_tokens, gen_ai.usage.output_tokens, gen_ai.request.model, plus cache read/write se presenti) e li converte in dizionario compatibile con UsageEvent; il campo user_id viene da resource attribute "tokenlens.user"; source="otel"; idempotente su trace_id+span_id
- routers/events.py: monta i due endpoint /otel/v1/* su main.py; persiste gli UsageEvent risultanti via SQLAlchemy
- tests/test_otel_receiver.py: testa con payload OTLP JSON sintetico che gli span vengano mappati correttamente in UsageEvent (almeno 5 casi: span con tutti i campi, span senza cache tokens, span senza model, batch di 3 span, token ingest non valido → 401)

NON toccare altri file già esistenti salvo aggiungere il router a main.py.
Al termine: 3 righe di riepilogo, poi fermati.
```

---

### AGENT-05 · Fallback ingest + session parser
*Dipende da: AGENT-04 completato e committato*
```
Implementa AGENT-05 di TokenLens.
Leggi SPEC.md §4.2 (fallback mechanism) e §6.1.2 (fallback endpoints).
Nel modulo `server/` aggiungi:
- routers/events.py (estendi): POST /api/v1/events (singolo) e POST /api/v1/events/batch (fino a 100); schema Pydantic in schemas/event_schema.py; source="session-file"; auto-crea utente se non esiste
- tests/test_events.py: ingest singolo OK, batch OK, batch >100 → 422, token mancante → 401

Nel modulo `tklens-cli/` completa src/commands/collect.ts:
- --tool=copilot-cli: scansiona i path standard di sessione Copilot (VS Code workspace/global storage: ~/.config/Code/User/workspaceStorage/**/*.json su Linux, ~/Library/Application Support/Code/User/workspaceStorage/**/*.json su Mac); estrae input_tokens, output_tokens, model; POSTa a /api/v1/events/batch
- --tool=claude-code: scansiona ~/.claude/ per file JSONL di log; estrae token counts; POSTa a /api/v1/events/batch
- --dry-run: stampa gli eventi trovati senza inviarli
- I dati sono "stime": i log inviati hanno source="session-file"

Al termine: 3 righe di riepilogo, poi fermati.
```

---

### AGENT-06 · Analytics endpoints
*Dipende da: AGENT-05 completato e committato*
```
Implementa AGENT-06 di TokenLens.
Leggi SPEC.md §6.1.3 (analytics endpoints).
Nel modulo `server/` aggiungi:
- services/analytics_service.py: funzioni pure (input: db session + parametri filtro) per summary, top_consumers, by_day, skill_efficiency; tutte le query usano SQLAlchemy ORM, non SQL raw
- routers/analytics.py: monta GET /api/v1/analytics/summary, /top-consumers, /skill-efficiency, /by-day su main.py; query params: user_id, from, to (ISO date string), tool, limit
- schemas/analytics_schema.py: modelli Pydantic per tutte le response
- tests/test_analytics.py: inserisce fixture di UsageEvent nel DB di test, poi verifica summary totals, top-consumers order, by-day grouping (almeno 6 test)

Al termine: 3 righe di riepilogo, poi fermati.
```

---

### AGENT-07 · Registry CRUD + versioning + ratings
*Dipende da: AGENT-06 completato e committato*
```
Implementa AGENT-07 di TokenLens.
Leggi SPEC.md §5.2 (skill models) e §6.1.4 (registry endpoints, solo CRUD e ratings — non il proxy).
Nel modulo `server/` aggiungi:
- services/registry_service.py: create_skill, get_skill, list_skills (con filtri tag/search/sort), update_skill (bumpa versione, crea skill_versions record), soft_delete_skill, upsert_rating; dopo ogni rating calcola e aggiorna rating_avg e rating_count sulla skill
- routers/skills.py: monta tutti gli endpoint /api/v1/skills* e /api/v1/skills/{id}/ratings su main.py; auth su POST/PUT/DELETE/rating-POST via header Authorization Bearer
- schemas/skill_schema.py: SkillCreate, SkillUpdate, SkillResponse, RatingCreate, RatingResponse
- tests/test_skills.py: CRUD completo, versioning (update crea nuovo record in skill_versions), rating upsert, sort by rating/efficiency/popular/new, search full-text su name+summary+tags (almeno 10 test)

NON implementare /proxy e /download in questo agent.
Al termine: 3 righe di riepilogo, poi fermati.
```

---

### AGENT-08 · Pull-through proxy + adapters
*Dipende da: AGENT-07 completato e committato*
```
Implementa AGENT-08 di TokenLens.
Leggi SPEC.md §5.2 (skill.toml format e targets) e §6.1.4 (proxy e download endpoints).
Nel modulo `server/` aggiungi:
- services/proxy_service.py: fetch_and_cache(origin_url) — scarica un tarball da origin_url, valida il checksum sha256, estrae skill.toml, persiste la skill con origin="remote" e origin_url set; se già in cache (origin_url già presente) ritorna l'id esistente senza ri-scaricare
- adapters/claude_code_adapter.py: dato il payload canonico, produce un tarball con struttura skill/<skill-id>/SKILL.md + metadati, dove SKILL.md segue il formato Claude Code (frontmatter YAML + corpo Markdown)
- adapters/copilot_adapter.py: produce un tarball con .copilot/prompts/<skill-id>.instructions.md nel formato Copilot custom instructions
- services/adapter_service.py: dispatcher che chiama l'adapter giusto in base al parametro target
- routers/skills.py (estendi): POST /api/v1/proxy/resolve {origin_url} → chiama proxy_service; GET /api/v1/skills/{id}/download?target=claude-code|copilot → chiama adapter_service e streama il tarball come application/x-tar
- tests/test_proxy.py: mock di un server HTTP remoto con un tarball di skill valido; verifica cache-hit al secondo resolve; verifica che i due adapter producano file nella posizione attesa nel tarball

Al termine: 3 righe di riepilogo, poi fermati.
```

---

## FASE 3 — CLI, UI, intelligence

### AGENT-09 · CLI: registry commands
*Dipende da: AGENT-03 + AGENT-07 + AGENT-08 completati e committati*
```
Implementa AGENT-09 di TokenLens.
Leggi SPEC.md §6.2 (tklens-cli commands: search, info, add, publish, pull, rate).
Nel modulo `tklens-cli/` completa i comandi stub:
- search.ts: GET /api/v1/skills?search=<query>&tag=<tag>&sort=<sort>; stampa una tabella (nome, summary, rating, avg_tokens)
- info.ts: GET /api/v1/skills/{id}; stampa dettaglio completo inclusi usage instructions e versioni
- add.ts: GET /api/v1/skills/{id}/download?target=<target>; se --target=auto rileva il tool presente (cerca .claude/ → claude-code, .copilot/ → copilot); scarica il tarball ed estrae nella cwd; stampa i file creati
- publish.ts: legge skill.toml nella cwd (o nel path passato), crea un tarball con il payload, POST /api/v1/skills; stampa l'id assegnato
- pull.ts: POST /api/v1/proxy/resolve {origin_url}; stampa l'id risultante e "cached locally"
- rate.ts: POST /api/v1/skills/{id}/ratings {stars, comment}; conferma

Tutti i comandi devono gestire errori di rete e auth (401, 404) con messaggi leggibili.
Al termine: 3 righe di riepilogo, poi fermati.
```

---

### AGENT-10 · CLI: collect fallback (revisione)
*Dipende da: AGENT-05 + AGENT-09 completati e committati*
```
Implementa AGENT-10 di TokenLens.
Leggi SPEC.md §4.2 e il collect.ts già scritto da AGENT-05.
Migliora tklens-cli/src/commands/collect.ts:
- aggiungi --since=<ISO date> per raccogliere solo eventi più recenti di quella data
- aggiungi --output=json per stampare gli eventi trovati invece di inviarli (utile per debug)
- aggiungi rilevamento automatico del tool se --tool non è specificato (cerca entrambi i path e raccoglie da quelli trovati)
- aggiungi progress bar (usa il pacchetto cli-progress) durante la scansione dei file
- scrivi tests/collect.test.ts: mock del filesystem con session file sintetici per entrambi i tool, verifica che i token vengano estratti e il batch POST venga chiamato con i valori corretti

Al termine: 3 righe di riepilogo, poi fermati.
```

---

### AGENT-11 · Dashboard charts
*Dipende da: AGENT-02 + AGENT-06 completati e committati*
```
Implementa AGENT-11 di TokenLens.
Leggi SPEC.md §6.3 (Dashboard page e charts).
Nel modulo `frontend/` implementa la pagina Dashboard.jsx completa:
- aggiorna src/api/client.js: hooks reali (non mock) useAnalyticsSummary({from,to}), useByDay({from,to}), useTopConsumers({limit,from,to}), useToolBreakdown({from,to})
- components/charts/TokenTrendChart.jsx: LineChart Recharts con una linea per tool, asse X = date, asse Y = total_tokens; dati da useByDay; filtro date picker (ultimi 7 / 30 giorni)
- components/charts/TopConsumersChart.jsx: BarChart orizzontale, top 10 utenti per total_tokens nel periodo
- components/charts/ToolBreakdownPie.jsx: PieChart tool vs token totali
- Dashboard.jsx: monta i 3 chart + 4 KPI card (total tokens oggi, settimana, utenti attivi, skill usate)
- gestisci loading e error state in ogni component

Al termine: 3 righe di riepilogo, poi fermati.
```

---

### AGENT-12 · Skill Browser + Detail + ratings UI
*Dipende da: AGENT-02 + AGENT-07 + AGENT-08 completati e committati*
```
Implementa AGENT-12 di TokenLens.
Leggi SPEC.md §6.3 (SkillBrowser e SkillDetail pages).
Nel modulo `frontend/` implementa:
- aggiorna src/api/client.js: hooks useSkills({tag,search,sort}), useSkill(id), useSkillRatings(id), usePostRating(id), useDownloadSkill(id,target)
- components/SkillCard.jsx: card con nome, summary, badge tag, stelle (rating_avg), avg_tokens badge colorato (verde <1000, giallo <3000, rosso ≥3000), use_count
- components/RatingStars.jsx: 5 stelle cliccabili + textarea commento + pulsante Submit; disabilitato se non loggato
- components/CommentList.jsx: lista commenti con autore, stelle, testo, data
- pages/SkillBrowser.jsx: grid di SkillCard con barra di ricerca, filtro tag (multi-select), sort dropdown (rating/efficiency/popular/new); pagination (20 per pagina)
- pages/SkillDetail.jsx: header con metadati, sezione usage instructions (Markdown renderizzato), versioni, RatingStars, CommentList; pulsante "Add to workspace" che chiama download con target auto-rilevato dal browser (URL param o localStorage)
- pages/SkillEditor.jsx: form per compilare skill.toml (id, name, summary, description, tags, usage instructions) e fare publish via POST /api/v1/skills

Al termine: 3 righe di riepilogo, poi fermati.
```

---

### AGENT-13 · Recommendation engine + panel UI
*Dipende da: AGENT-06 + AGENT-07 completati e committati (server); AGENT-02 + AGENT-11 (frontend)*
```
Implementa AGENT-13 di TokenLens.
Leggi SPEC.md §6.1.5 (recommendations endpoint e 3 regole).

SERVER — services/recommendation_engine.py:
- Regola 1 (skill gap): per ogni language con >5 eventi senza skill_id, trova la skill con tag corrispondente e avg_tokens più basso; calcola risparmio stimato in token
- Regola 2 (context bloat): se avg input_tokens utente > 1.5× media team → raccomanda riduzione contesto; usa dati ultimi 30 giorni
- Regola 3 (efficient swap): per ogni language in cui l'utente ha lavorato, se esiste skill con avg_tokens < 70% della media manuale dell'utente → suggeriscila
- routers/recommendations.py: GET /api/v1/recommendations/{user_id}; risposta con array di {type, skill_id?, reason, potential_savings_tokens?, potential_savings_pct?}
- tests/test_recommendations.py: fixture con eventi realistici, verifica che ciascuna delle 3 regole si attivi alle condizioni corrette (almeno 1 test per regola)

FRONTEND — components/RecommendationPanel.jsx:
- chiama useRecommendations(userId)
- mostra ogni raccomandazione come card con icona (💡 skill gap, ⚡ context bloat, 🔄 efficient swap), testo reason, risparmio stimato, e se c'è uno skill_id un pulsante "Add to workspace" che porta a SkillDetail
- integra in pages/UserDetail.jsx in sidebar o sezione dedicata

Al termine: 3 righe di riepilogo, poi fermati.
```

---

## FASE 4 — Packaging & docs

### AGENT-14 · Docker Compose + CI
*Dipende da: tutti i moduli completati e committati*
```
Implementa AGENT-14 di TokenLens.
Leggi SPEC.md §7 (infrastructure).
Crea nella root:
- docker-compose.yml: servizi server (porta 8080) e frontend (porta 3000); server con volume ./data:/app/data per SQLite + blob; frontend dipende da server; variabili d'ambiente come da spec
- docker-compose.prod.yml: override che aggiunge servizio postgres (postgres:16-alpine), modifica DATABASE_URL del server; aggiunge variabili S3-compatible per il blob store (BLOB_S3_ENDPOINT, BLOB_S3_BUCKET)
- .env.example con tutte le variabili necessarie e valori di default sicuri
- .github/workflows/server-ci.yml: trigger push/PR su server/**; steps: checkout, setup python 3.11, pip install, pytest con copertura; badge di stato
- .github/workflows/cli-ci.yml: trigger su tklens-cli/**; steps: checkout, node 20, npm ci, npm run build, npm test
- .github/workflows/frontend-ci.yml: trigger su frontend/**; steps: checkout, node 20, npm ci, npm run build (verifica che Vite buildi senza errori)

Verifica che `docker compose up --build` porti su server e frontend senza errori.
Al termine: 3 righe di riepilogo, poi fermati.
```

---

### AGENT-15 · Seed skills
*Dipende da: AGENT-08 completato e committato*
```
Implementa AGENT-15 di TokenLens.
Leggi SPEC.md §5.2 (formato skill.toml e targets) e §6.2 (formato publish).
Crea `examples/skills/` con 3 skill in formato canonico, ciascuna in una sottocartella:

1. mulesoft-api-doc-generator/
   - skill.toml: genera documentazione Markdown da file RAML/OAS MuleSoft
   - payload/claude-code/SKILL.md: istruzioni per Claude Code (frontmatter YAML + prompt template dettagliato per analizzare una API spec MuleSoft e produrre documentazione strutturata)
   - payload/copilot/mulesoft-api-doc.instructions.md: stessa skill in formato Copilot custom instructions

2. java-unit-test-generator/
   - skill.toml: genera test JUnit 5 + Mockito da una classe Java
   - payload/claude-code/SKILL.md
   - payload/copilot/java-unit-test.instructions.md

3. git-commit-message/
   - skill.toml: genera commit message convenzionale da un diff
   - payload/claude-code/SKILL.md
   - payload/copilot/git-commit-message.instructions.md

Crea anche examples/skills/README.md che spiega il formato e come contribuire nuove skill.
Al termine: 3 righe di riepilogo, poi fermati.
```

---

### AGENT-16 · README + CONTRIBUTING + setup docs
*Dipende da: tutti gli agent completati e committati*
```
Implementa AGENT-16 di TokenLens.
Il README.md nella root esiste già (non sovrascriverlo interamente). Aggiorna solo le sezioni:
- "Quickstart": verifica che i comandi siano corretti rispetto all'implementazione reale
- aggiungi sezione "OTel setup verificato" con le variabili d'ambiente esatte per Copilot CLI e Claude Code, come accertate dall'implementazione di AGENT-04
- aggiungi sezione "tklens CLI reference" con tabella dei comandi reali

Crea da zero:
- CONTRIBUTING.md: come clonare, come far girare server/frontend/cli in locale senza Docker, come aggiungere un collector per un nuovo tool (sezione "Adding a tool"), come aggiungere una skill al registry, convenzioni di commit
- docs/otel-setup.md: guida approfondita per l'integrazione OTel con entrambi i tool, incluse sezioni per macOS, Linux e shell rc (bash/zsh profile)
- docs/skill-format.md: specifica completa del formato skill.toml con tutti i campi, esempi, e spiegazione degli adapter

Al termine: 3 righe di riepilogo, poi fermati.
```

---

### AGENT-17 · MCP server — first-class (v0.2)
*Dipende da: AGENT-07 + AGENT-08 completati e committati*
```
Implementa AGENT-17 di TokenLens.
Leggi SPEC.md §6.4 integralmente (mcp-server v0.2 — NON è opzionale, è first-class).

Crea `mcp-server/` con la struttura esatta da spec (src/tools/, src/resources/, src/prompts/, src/transport/).

TRANSPORT (src/transport/):
- stdio.ts: usa StdioServerTransport da @modelcontextprotocol/sdk
- http-sse.ts: usa SSEServerTransport; listen su TOKENLENS_MCP_PORT (default 8082); endpoint /sse
- index.ts: branch su TOKENLENS_MCP_TRANSPORT=http → HTTP/SSE, altrimenti stdio

TOOLS (6 — src/tools/):
- searchSkills.ts: GET /api/v1/skills con params query/tag/sort; ritorna array formattato
- getSkill.ts: GET /api/v1/skills/{id}; ritorna metadati + usage instructions
- addSkillToWorkspace.ts: GET /api/v1/skills/{id}/download?target=<target>; estrae tarball in workspace_path (default process.cwd()); se TOKENLENS_MCP_TRACK_USAGE=true chiama loopback.ts
- rateSkill.ts: POST /api/v1/skills/{id}/ratings {stars, comment?}; richiede TOKENLENS_API_KEY
- getMyUsage.ts: GET /api/v1/analytics/summary?user_id=<TOKENLENS_USER>&from=&to=; ritorna totali
- publishSkill.ts: accetta skill_toml (stringa) e payload_b64 (base64 tarball); POST /api/v1/skills; richiede TOKENLENS_API_KEY

RESOURCES (src/resources/skillResource.ts):
- resources/list: GET /api/v1/skills → array di {uri: "skill://{id}", name, mimeType: "text/plain"}
- resources/read: GET /api/v1/skills/{id} → concatena manifest_toml + "\n\n" + description + usage

PROMPTS (src/prompts/suggestSkill.ts):
- prompt "suggest_skill_for_context": argomenti {language: string, task_description: string}
- chiama GET /api/v1/recommendations/<TOKENLENS_USER>; filtra per language; ritorna top 3 come prompt template con estimated savings

TOKEN LOOP-BACK (src/loopback.ts):
- funzione trackUsage(skillId): POST /api/v1/events con {user_id: TOKENLENS_USER, tool: "mcp", skill_id, source: "mcp", input_tokens: 0, output_tokens: 0, timestamp: now()}
- chiamata solo se TOKENLENS_MCP_TRACK_USAGE !== "false"

CLI (aggiungi in tklens-cli/src/commands/mcp-setup.ts):
- legge TOKENLENS_ENDPOINT e TOKENLENS_API_KEY dal config
- con --transport=stdio (default): stampa snippet JSON per ~/.claude/claude_desktop_config.json
- con --transport=http: stampa snippet per .copilot/mcp.json

CONFIGURAZIONE DOCKER:
- in docker-compose.yml aggiungi servizio `mcp` (profile: mcp) con le variabili d'ambiente da spec

TESTS (src/__tests__/):
- test per ogni tool con mock di apiClient (almeno 2 casi per tool: success + errore API)
- test per resources/list e resources/read
- test per loopback: verifica che POST /api/v1/events venga chiamato su addSkillToWorkspace
- test per suggest_skill_for_context prompt

package.json: bin: { "tokenlens-mcp": "./dist/index.js" }; dipendenze: @modelcontextprotocol/sdk, node-fetch o axios, tar-stream
README.md: setup per Claude Code (claude_desktop_config.json), Copilot CLI (copilot mcp add), e HTTP/SSE mode per agent remoti

Al termine: 3 righe di riepilogo, poi fermati.
```

---

## FASE v0.2 — MCP + Stabilità Frontend

### AGENT-18 · tklens mcp-setup command
*Dipende da: AGENT-17 completato e committato*
```
Implementa AGENT-18 di TokenLens.
Leggi SPEC.md §6.2 (tklens-cli) e §6.4 (mcp-server — sezione Distribution).

Nel modulo `tklens-cli/` aggiungi:
- src/commands/mcp-setup.ts: comando che genera snippet di configurazione MCP
  - --transport=stdio (default): genera JSON per ~/.claude/claude_desktop_config.json
    ```json
    {
      "mcpServers": {
        "tokenlens": {
          "command": "npx",
          "args": ["@tokenlens/mcp"],
          "env": {
            "TOKENLENS_ENDPOINT": "<endpoint>",
            "TOKENLENS_API_KEY": "<apiKey>",
            "TOKENLENS_USER": "<userId>"
          }
        }
      }
    }
    ```
  - --transport=http: genera JSON per .copilot/mcp.json con url: <endpoint>:8082/sse
  - --apply: invece di stampare, scrive direttamente nel file di destinazione (con backup .bak)
  - --show-current: mostra la config MCP esistente (se presente)

Aggiorna src/lib/config.ts per includere il campo mcpTransport (stdio|http).

Tests: tests/mcp-setup.test.ts — verifica che l'output JSON sia corretto per entrambi i transport.

Al termine: 3 righe di riepilogo, poi fermati.
```

---

### AGENT-19 · Documentazione v0.2 — allineamento MCP
*Dipende da: AGENT-17 + AGENT-18 completati e committati*
```
Implementa AGENT-19 di TokenLens.
Leggi SPEC.md §6.4 (mcp-server v0.2) per conoscere l'implementazione reale prima di scrivere.

Aggiorna i seguenti file esistenti — NON riscriverli, solo le sezioni indicate:

README.md:
- Sezione "Quickstart": aggiungi sotto-sezione "Enable MCP (optional)" con i passi:
  1. `tklens mcp-setup --apply` per Claude Code (stdio)
  2. `tklens mcp-setup --transport=http --apply` per Copilot / agent HTTP
  3. verifica con `tklens whoami`
- Sezione "Architecture": aggiorna la tabella dei componenti con mcp-server (porta 8082, HTTP/SSE)
- Sezione "Tools available via MCP": tabella con i 6 tool (nome, descrizione breve, auth required)

CONTRIBUTING.md:
- Aggiungi sezione "Running mcp-server locally":
  - `cd mcp-server && npm install && npm run build`
  - stdio: `TOKENLENS_ENDPOINT=http://localhost:8080 node dist/index.js`
  - HTTP/SSE: `TOKENLENS_MCP_TRANSPORT=http node dist/index.js`
- Aggiungi sezione "Adding a new MCP tool": passi per aggiungere un tool in src/tools/, registrarlo in server.ts, scrivere il test

docs/otel-setup.md:
- Aggiungi nota in fondo: "MCP loop-back": quando si usa add_skill_to_workspace via MCP, il server registra automaticamente un UsageEvent — nessuna configurazione aggiuntiva richiesta.

Crea da zero docs/mcp-setup.md:
- Panoramica: cosa espone il server MCP (tool, resources, prompts)
- Sezione "stdio (Claude Code)": configurazione claude_desktop_config.json, `tklens mcp-setup --apply`, verifica
- Sezione "HTTP/SSE (Copilot, agent remoti)": avvio docker-compose --profile mcp, configurazione .copilot/mcp.json, `tklens mcp-setup --transport=http --apply`
- Sezione "MCP Resources": come leggere una skill come risorsa (`skill://<id>`)
- Sezione "MCP Prompts": come usare suggest_skill_for_context da Claude Code
- Sezione "Token loop-back": spiegazione di come ogni add_skill_to_workspace genera un UsageEvent visibile nel dashboard
- Sezione "Env vars reference": tabella di tutte le variabili TOKENLENS_MCP_*

Al termine: 3 righe di riepilogo, poi fermati.
```

---

## Ordine di esecuzione consigliato

```
AGENT-01 ──► AGENT-02 ──► AGENT-03   ← Fase 1, in ordine (non parallelo)
    │
    ▼
AGENT-04 ──► AGENT-05 ──► AGENT-06 ──► AGENT-07 ──► AGENT-08   ← Fase 2
                                                          │
    ┌─────────────────────────────────────────────────────┘
    ▼
AGENT-09 ──► AGENT-10 ──► AGENT-11 ──► AGENT-12 ──► AGENT-13   ← Fase 3
    │
    ▼
AGENT-14 ──► AGENT-15 ──► AGENT-16              ← Fase 4 (packaging v0.1)
    │
    ▼
AGENT-17 ──► AGENT-18 ──► AGENT-19              ← Fase v0.2 (MCP first-class + docs)
    │
    ▼
AGENT-20 ──► AGENT-21 ──► AGENT-22 ──► AGENT-23 ← Fase v0.3 (auth + ops + collect daemon + dashboard)
```

---

## FASE v0.3 — Auth hardening, ops tooling, daemon collect, dashboard per-user

### AGENT-20 · Auth hardening — login validation + API key lifecycle
*Dipende da: AGENT-01 + AGENT-03 completati e committati*
```
Implementa AGENT-20 di TokenLens.
Leggi server/config.py (settings.ingest_token), server/routers/events.py (_verify_token),
tklens-cli/src/commands/login.ts e src/lib/apiClient.ts prima di scrivere qualsiasi riga.

PROBLEMA NOTO: `tklens login --api-key=qualsiasi` ha sempre successo perché il comando
salva la chiave senza verificarla contro il server. Analogamente, generare la chiave
iniziale richiede accesso manuale al .env, non esiste un flusso guidato.

SERVER — aggiungi in server/routers/auth.py (file nuovo):
- GET /api/v1/auth/verify: richiede Authorization: Bearer <token>; chiama _verify_token
  (stessa logica di events.py); risponde 200 {"valid": true, "user": "service"} oppure 401.
  Non creare una tabella utenti separata: il token è unico e di servizio (settings.ingest_token).
- POST /api/v1/admin/rotate-key (richiede il vecchio token): genera un nuovo token sicuro
  (secrets.token_urlsafe(32)), aggiorna settings.ingest_token IN MEMORIA e riscrive il valore
  in .env (riga INGEST_TOKEN=<nuovo>); risponde {"token": "<nuovo>"}. Logga il cambio.
  NOTA: non usare pydantic-settings reload; sovrascrivere la riga in .env è sufficiente per
  il prossimo riavvio; il token in-memory diventa attivo immediatamente.
- Monta il router su main.py con prefix /api/v1.
- tests/test_auth.py: verify con token valido → 200, con token errato → 401;
  rotate-key sostituisce la riga in .env e il valore in settings (mock .env con tmp_path).

CLI — modifica tklens-cli/src/commands/login.ts:
- Dopo aver salvato endpoint + api-key in config, chiama GET /api/v1/auth/verify con il token.
- Se 401: stampa errore "API key non valida. Controlla INGEST_TOKEN sul server." e cancella
  la chiave appena salvata (writeConfig senza apiKey).
- Se errore di rete (server non raggiungibile): stampa warning "Server non raggiungibile —
  chiave salvata ma non verificata." e salva comunque (utile per setup offline).
- Se 200: stampa "Autenticato su <endpoint>." (comportamento attuale ma solo dopo verifica).

SCRIPT — crea scripts/generate-key.sh (bash) e scripts/generate-key.ps1 (PowerShell):
- Genera un token sicuro (openssl rand -base64 32 | tr -d '=+/' | head -c 43 su bash;
  [System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]
  ::GetBytes(32)) su PowerShell).
- Scrive o sostituisce la riga INGEST_TOKEN=<token> nel file .env nella directory corrente.
- Stampa il token a schermo con un messaggio tipo:
    ✔ INGEST_TOKEN generato e salvato in .env
    Chiave: <token>
    Conservala — non verrà mostrata di nuovo.
- Gli script devono essere idempotenti: se INGEST_TOKEN esiste già in .env,
  chiedono conferma (input y/n) prima di sovrascrivere.

Al termine: 3 righe di riepilogo, poi fermati.
```

---

### AGENT-21 · Ops tooling — startup scripts + health check + onboarding nuovo utente
*Dipende da: AGENT-14 + AGENT-20 completati e committati*
```
Implementa AGENT-21 di TokenLens.
Leggi scripts/ (file esistenti), docker-compose.yml e server/main.py (GET /health)
prima di scrivere qualsiasi file.

OBIETTIVO: chiunque abbia Docker installato deve poter avviare l'infrastruttura con
un singolo comando; un nuovo utente (senza Docker) deve poter configurare il client
con un singolo script che non richiede accesso al server Docker.

SCRIPT DI AVVIO SERVER — crea scripts/start-server.sh (bash) e scripts/start-server.ps1:
- Verificano che docker e docker compose siano disponibili; se no, stampano istruzioni
  e terminano con exit 1.
- Verificano che .env esista; se no, copiano .env.example in .env e stampano avviso
  "Configura INGEST_TOKEN in .env prima di continuare." e terminano.
- Verificano che INGEST_TOKEN in .env non sia il valore di default "change-me";
  se lo è, stampano "Esegui scripts/generate-key.sh prima di avviare." e terminano.
- Eseguono: docker compose up -d --build
- Polling di GET http://localhost:8080/health ogni 2 secondi, max 30 tentativi;
  se dopo 30 tentativi il server non risponde 200, stampano i log (docker compose logs server)
  e terminano con exit 1.
- Se health OK: stampano "✔ TokenLens server attivo su http://localhost:8080" e il valore
  mascherato di INGEST_TOKEN (prime 6 char + "…").

SCRIPT ONBOARDING NUOVO UTENTE — crea scripts/new-user-setup.sh e scripts/new-user-setup.ps1:
Questo script viene eseguito su una macchina che NON ospita il server.
Chiede all'utente (via prompt interattivo):
  1. URL del server TokenLens (default: http://localhost:8080)
  2. API key (INGEST_TOKEN fornita dall'amministratore)
Poi esegue in sequenza:
  a. Verifica che node >= 20 sia installato; se no, stampa istruzioni e termina.
  b. npm install -g @tokenlens/cli (o node tklens-cli/bin/run.js se in sviluppo locale:
     controlla se tklens è già nel PATH prima di installare).
  c. tklens login --endpoint=<url> --api-key=<key>
     (dopo AGENT-20 questo verifica la chiave contro il server)
  d. tklens collect --output=json 2>&1 | head -5  (dry-run per verificare che funzioni)
  e. Stampa riepilogo:
       ✔ tklens configurato per <url>
       ✔ <N> eventi token trovati in locale (pronti per tklens collect)
       Prossimo passo: aggiungi `tklens collect` al tuo crontab/Task Scheduler
       oppure usa `tklens collect --daemon` (disponibile dopo AGENT-22).

Al termine: 3 righe di riepilogo, poi fermati.
```

---

### AGENT-22 · Silent background collector — daemon + auto-schedule
*Dipende da: AGENT-10 + AGENT-21 completati e committati*
```
Implementa AGENT-22 di TokenLens.
Leggi tklens-cli/src/commands/collect.ts integralmente prima di scrivere.
Il collect.ts attuale è batch/one-shot. L'obiettivo è aggiungere una modalità
daemon che gira in background e invia i consumi senza intervento dell'utente.

CLI — aggiungi flag a tklens-cli/src/commands/collect.ts:
- --daemon: avvia un loop infinito con intervallo configurabile (default 15 minuti).
  Ogni ciclo:
    1. Legge il timestamp dell'ultimo invio da ~/.tklens/last-collect.json
       {"timestamp": "<ISO>", "sent": <N>}
    2. Chiama la logica esistente con --since=<timestamp ultimo invio>
    3. Se trovati eventi: li invia via POST /api/v1/events/batch
    4. Aggiorna last-collect.json con il nuovo timestamp e il totale inviato
    5. Dorme per --interval=<minuti> (default 15, minimo 5)
  Il processo scrive un PID file in ~/.tklens/collect.pid.
  SIGTERM / SIGINT: cleanup PID file e uscita pulita.
  Tutti gli errori (rete, auth) vengono loggati in ~/.tklens/collect.log senza
  crashare il daemon; il ciclo riprende all'intervallo successivo.
- --interval=<minuti>: solo con --daemon; default 15.
- --stop: legge ~/.tklens/collect.pid e invia SIGTERM al processo; rimuove il PID file.
- --status: stampa se il daemon è attivo (controlla PID file + kill -0) e quanti
  eventi sono stati inviati nell'ultima sessione (da last-collect.json).

CLI — aggiungi tklens-cli/src/commands/collect-schedule.ts (alias: tklens collect --schedule):
- Su macOS/Linux: scrive una riga crontab (crontab -l + append) per eseguire
  `tklens collect --since=$(date -d "20 minutes ago" --iso-8601=seconds)` ogni 20 minuti.
  Stampa la riga crontab aggiunta e istruzioni per rimuoverla.
- Su Windows: crea un Task Scheduler task via schtasks.exe con trigger "ogni 20 minuti",
  action: `tklens collect`.
  Stampa il nome del task creato (TokenLens-Collect) e istruzioni per rimuoverlo.
- --unschedule: rimuove la crontab entry o il Task Scheduler task.

Tests — tklens-cli/tests/collect-daemon.test.ts:
- Mock di ApiClient.post; verifica che dopo N cicli simulati last-collect.json
  contenga il timestamp aggiornato e il totale eventi cumulato.
- Verifica che --stop invii SIGTERM al PID nel PID file.
- Verifica che errori di rete nel ciclo non crashino il daemon (il ciclo continua).

Al termine: 3 righe di riepilogo, poi fermati.
```

---

### AGENT-23 · Dashboard per-user — aggregazioni per utente + UserDetail analytics
*Dipende da: AGENT-11 + AGENT-12 + AGENT-06 completati e committati*
```
Implementa AGENT-23 di TokenLens.
Leggi frontend/src/pages/Dashboard.jsx, frontend/src/pages/UserDetail.jsx,
frontend/src/api/client.js e server/routers/analytics.py prima di scrivere.

OBIETTIVO: la Dashboard deve permettere di filtrare tutti i grafici per singolo utente
e la pagina UserDetail deve mostrare le analytics complete di quell'utente.

SERVER — nessuna modifica richiesta: /analytics/summary già supporta ?user_id=<id>
e /analytics/top-consumers restituisce già il breakdown per utente.
Verifica che /analytics/by-day accetti ?user_id= e lo passi al service (controlla
analytics_service.get_by_day — se manca il filtro user_id, aggiungilo).

FRONTEND — modifica frontend/src/api/client.js:
- useByDay: aggiungi parametro userId; passa ?user_id=<userId> se presente.
- useAnalyticsSummary: già accetta user_id; assicurati che il hook lo includa nei params.
- Aggiungi useUsers(): GET /api/v1/users → lista di {id, created_at, event_count?};
  se l'endpoint non esiste ancora, aggiungilo in server/routers/users.py:
  GET /api/v1/users → lista di User dal DB, con join a UsageEvent per event_count.
  Monta il router su main.py.

FRONTEND — modifica frontend/src/pages/Dashboard.jsx:
- Aggiungi un dropdown "Utente" sopra i KPI con opzione "Tutti gli utenti" (default)
  più ogni userId distinto (dati da useUsers()).
- Quando un utente è selezionato, passa userId a tutti gli hook
  (useAnalyticsSummary, useByDay, TokenTrendChart, TopConsumersChart, ToolBreakdownPie).
- I KPI mostrano i totali filtrati per quell'utente.
- TopConsumersChart: se un utente è selezionato, mostra il breakdown per tool
  (non per utente, perché stiamo già filtrando per utente).

FRONTEND — modifica frontend/src/pages/UserDetail.jsx:
- La pagina riceve l'userId dall'URL (route /users/:userId).
- Mostra un header con l'userId e la data di primo evento.
- Sezione "Consumi": monta TokenTrendChart filtrato per questo userId (ultimi 30 giorni).
- Sezione "Top tool usati": BarChart orizzontale dei tool di questo utente
  (usa useAnalyticsSummary({userId}) → by_tool).
- Sezione "Riepilogo": KPI card con total_tokens, input_tokens, output_tokens,
  cache_read_tokens dell'utente (ultimi 30 giorni e all-time).
- RecommendationPanel già esistente (da AGENT-13): lascialo dov'è.
- Aggiungi link "← Dashboard" in alto.

FRONTEND — aggiungi link agli utenti da TopConsumersChart:
- Ogni barra / riga di TopConsumersChart deve essere cliccabile e portare a /users/<userId>.

Tests (opzionali ma graditi): se esistono test Vitest/RTL nel progetto, aggiungi
un test per Dashboard che verifica che il dropdown utente filtri la query key di React Query.

Al termine: 3 righe di riepilogo, poi fermati.
```

---

### AGENT-24 · Documentazione v0.3 — auth, ops tooling, daemon collector, dashboard per-user
*Dipende da: AGENT-20 + AGENT-21 + AGENT-22 + AGENT-23 completati e committati*
*Estende: AGENT-19 (documentazione v0.2)*
```
Implementa AGENT-24 di TokenLens.
Leggi README.md, GETTING_STARTED.md, GETTING_STARTED_EN.md e SPEC.md
(sezioni Authentication, Ops, CLI, Frontend) prima di scrivere qualsiasi cosa.
NON toccare AGENTS.md, CLAUDE.md, CONTRIBUTING.md o file di codice.

OBIETTIVO: allineare tutta la documentazione utente alle feature introdotte in
AGENT-20 (auth hardening), AGENT-21 (ops tooling), AGENT-22 (daemon collector)
e AGENT-23 (dashboard per-user).

── README.md ──────────────────────────────────────────────────────────────────
Aggiorna le sezioni:

1. "Quick start" / "Getting started":
   - Sostituisci il passo manuale "imposta INGEST_TOKEN in .env" con:
       ```bash
       bash scripts/generate-key.sh   # oppure scripts/generate-key.ps1 su Windows
       bash scripts/start-server.sh   # oppure scripts/start-server.ps1
       ```
   - Rimuovi qualsiasi riferimento a impostare la chiave a mano nel .env.

2. "CLI usage" / "Raccolta dati":
   - Aggiungi sotto-sezione "Modalità daemon":
       ```bash
       tklens collect --daemon            # avvia in background, ogni 15 minuti
       tklens collect --daemon --interval=30
       tklens collect --status            # verifica se il daemon è attivo
       tklens collect --stop              # ferma il daemon
       ```
   - Aggiungi sotto-sezione "Schedulazione automatica":
       ```bash
       tklens collect-schedule            # aggiunge crontab entry (macOS/Linux)
                                          # o Task Scheduler task (Windows)
       tklens collect-schedule --unschedule
       ```

3. "Authentication" (crea se non esiste):
   - Spiega che `tklens login` verifica la chiave contro il server al momento del salvataggio.
   - Documenta il flusso di rotazione chiave:
       POST /api/v1/admin/rotate-key   Authorization: Bearer <vecchio-token>
       Risposta: {"token": "<nuovo>"}
   - Documenta GET /api/v1/auth/verify per health-check dell'autenticazione.

4. "Dashboard":
   - Aggiungi nota: il dropdown "Utente" filtra tutti i grafici per utente specifico.
   - Documenta la pagina /users/:userId con le sezioni Consumi, Top tool, Riepilogo.
   - Spiega che le barre in TopConsumersChart sono cliccabili e portano a /users/<id>.

── GETTING_STARTED.md (e GETTING_STARTED_EN.md) ──────────────────────────────
Aggiorna i passi di setup per un nuovo utente:

Passo 1 — Avvio server (amministratore):
  ```bash
  bash scripts/generate-key.sh    # genera INGEST_TOKEN in .env
  bash scripts/start-server.sh    # avvia Docker Compose + health check
  ```
  Copia e distribuisci il valore di INGEST_TOKEN stampato a schermo.

Passo 2 — Setup client (nuovo utente, senza Docker):
  ```bash
  bash scripts/new-user-setup.sh  # oppure new-user-setup.ps1 su Windows
  # chiede: URL server + API key
  # installa tklens-cli, esegue login verificato, dry-run collect
  ```

Passo 3 — Raccolta continua:
  ```bash
  tklens collect --daemon         # avvia raccolta in background
  # oppure
  tklens collect-schedule         # configura crontab/Task Scheduler
  ```

Mantieni la struttura esistente; aggiungi o aggiorna solo i passi interessati.
Aggiorna anche GETTING_STARTED_EN.md con le stesse modifiche in inglese.

── SPEC.md ────────────────────────────────────────────────────────────────────
Aggiungi o aggiorna le sezioni seguenti (usa headings già esistenti se presenti):

1. Authentication:
   - GET /api/v1/auth/verify — descrizione, request/response schema.
   - POST /api/v1/admin/rotate-key — descrizione, request/response schema,
     comportamento in-memory vs .env.

2. CLI commands:
   - `collect --daemon`, `--interval`, `--stop`, `--status`: descrizione e flag.
   - `collect-schedule` / `collect-schedule --unschedule`: descrizione e comportamento
     per macOS/Linux (crontab) e Windows (schtasks).
   - File di stato: ~/.tklens/collect.pid, ~/.tklens/last-collect.json,
     ~/.tklens/collect.log — schema e utilizzo.

3. Frontend routes:
   - /users/:userId — UserDetail: layout, sezioni, dati mostrati.
   - Dashboard — filtro utente: dropdown, comportamento, TopConsumersChart cliccabile.

4. Ops scripts (aggiungi se sezione manca):
   - scripts/generate-key.sh / .ps1 — scopo, idempotenza, output.
   - scripts/start-server.sh / .ps1 — prereq, health-check polling, exit code.
   - scripts/new-user-setup.sh / .ps1 — flusso interattivo, dry-run collect.

Diagramma fase v0.3 (aggiorna il diagramma delle fasi se presente in SPEC.md):
  AGENT-20 ──► AGENT-21 ──► AGENT-22 ──► AGENT-23 ──► AGENT-24
  (auth)       (ops)        (daemon)      (dashboard)   (docs v0.3)

Al termine: 3 righe di riepilogo di cosa è cambiato in ogni file, poi fermati.
```

