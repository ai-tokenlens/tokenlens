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

### AGENT-17 · MCP server (stretch — opzionale)
*Dipende da: AGENT-07 + AGENT-08 completati e committati*
```
Implementa AGENT-17 di TokenLens (modulo opzionale — non richiesto per l'MVP).
Leggi SPEC.md §6.4 (mcp-server).
Crea `mcp-server/` con:
- progetto Node 20 TypeScript che usa @modelcontextprotocol/sdk
- tools esposti:
  - search_skills(query, tag?, sort?): chiama GET /api/v1/skills e ritorna lista formattata
  - get_skill(id): chiama GET /api/v1/skills/{id} e ritorna metadati + usage instructions
  - add_skill_to_workspace(id, target?): chiama GET /api/v1/skills/{id}/download, estrae il tarball nella directory di lavoro corrente
  - rate_skill(id, stars, comment?): chiama POST /api/v1/skills/{id}/ratings
- Configurazione: legge TOKENLENS_ENDPOINT e TOKENLENS_API_KEY da env
- README.md: come configurarlo in Claude Code (claude_desktop_config.json) e in Copilot CLI (copilot mcp add)
- package.json con bin: { "tokenlens-mcp": "./dist/index.js" }

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
AGENT-14 ──► AGENT-15 ──► AGENT-16 ──► (AGENT-17)              ← Fase 4
```

## Checklist rapida pre-sessione

Prima di ogni sessione:
- [ ] Il/i task precedenti sono committati su git
- [ ] Sei nella root di `~/progetti/tokenlens`
- [ ] `SPEC.md`, `README.md` e `CLAUDE.md` sono presenti
- [ ] (Primo avvio) `claude` è installato e autenticato

Avvio sessione:
```bash
cd ~/progetti/tokenlens
claude   # oppure /clear se stai continuando nella stessa finestra
```
Incolla il prompt del prossimo agent. Aspetta. Leggi il riepilogo. Committa.
