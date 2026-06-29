# Getting Started with TokenLens

Questa guida ti porta da zero a TokenLens funzionante in meno di 10 minuti, passo per passo. Nessun passaggio è dato per scontato.

> **Versione:** compatibile con macOS 13+, Ubuntu 22.04+, Debian 12+, Windows 10/11  
> **Tempo stimato:** 5–10 minuti (escluso download Docker, se non lo hai già)

---

## Prima di iniziare — Cosa ti serve

| Requisito | Perché | Come verificare |
|-----------|--------|-----------------|
| **Docker Desktop** | Fa partire il server e la dashboard con un comando solo | `docker --version` |
| **Node.js 20+** | Serve per la CLI `tklens` | `node --version` |
| **Git** | Per scaricare il codice | `git --version` |
| **GitHub Copilot CLI** e/o **Claude Code** | Gli strumenti di cui tracciamo i token | — |

Non preoccuparti se manca qualcosa: lo script di setup lo installa per te.

---

## Passo 1 — Scarica TokenLens

Apri un terminale (su Windows: usa **PowerShell**, non il Prompt dei comandi).

```bash
git clone https://github.com/<owner>/tokenlens.git
cd tokenlens
```

Dovresti trovarti in una cartella che contiene `SPEC.md`, `docker-compose.yml` e la cartella `scripts/`.

---

## Passo 2 — Genera la chiave di accesso (amministratore del server)

> **Solo chi gestisce il server** esegue questo passo. Gli altri utenti del team ricevono la chiave dall'amministratore e saltano direttamente al [Passo 3b](#passo-3b--setup-per-un-nuovo-utente-senza-docker).

```bash
# macOS / Linux
bash scripts/generate-key.sh

# Windows (PowerShell)
.\scripts\generate-key.ps1
```

Lo script genera un token sicuro, lo scrive in `.env` come `INGEST_TOKEN` e lo mostra a schermo **una sola volta**. Se `INGEST_TOKEN` esiste già, chiede conferma prima di sovrascrivere.

Output atteso:
```
  ✔ INGEST_TOKEN generato e salvato in .env
  Chiave: <token>
  Conservala — non verrà mostrata di nuovo.
```

---

## Passo 3 — Avvia il server

```bash
# macOS / Linux
bash scripts/start-server.sh

# Windows (PowerShell)
.\scripts\start-server.ps1
```

Lo script verifica i prerequisiti (Docker installato, `.env` presente, `INGEST_TOKEN` non è il valore di default `change-me`), poi avvia Docker Compose e fa polling di `GET /health` ogni 2 secondi fino a conferma (max 30 tentativi).

Output atteso:
```
  ✔ TokenLens server attivo su http://localhost:8080
  Dashboard  →  http://localhost:3000
```

Se il server non parte entro 60 secondi, lo script stampa i log di Docker e termina con exit 1.

---

## Passo 3b — Setup per un nuovo utente (senza Docker)

Se sei un membro del team e non ospiti il server, chiedi la chiave (`INGEST_TOKEN`) all'amministratore e usa lo script di onboarding:

```bash
# macOS / Linux
bash scripts/new-user-setup.sh

# Windows (PowerShell)
.\scripts\new-user-setup.ps1
```

Lo script chiede:
1. URL del server TokenLens (default: `http://localhost:8080`)
2. API key fornita dall'amministratore

Poi in sequenza: installa `tklens`, esegue `tklens login` (che verifica la chiave contro il server) e un dry-run di `tklens collect` per confermare che tutto funzioni.

Output atteso:
```
  ✔ tklens configurato per http://<server>:8080
  ✔ <N> eventi token trovati in locale (pronti per tklens collect)
  Prossimo passo: aggiungi `tklens collect` al tuo crontab/Task Scheduler
                  oppure usa `tklens collect --daemon`
```

---

## Passo 4 — Esegui lo script di setup automatico (alternativa tutto-in-uno)

Se preferisci un setup guidato che fa tutto quanto sopra in un unico comando, scegli in base al sistema operativo.

### macOS

```bash
bash scripts/setup-macos.sh
```

### Linux (Ubuntu, Debian, Fedora…)

```bash
bash scripts/setup-linux.sh
```

### Windows (PowerShell)

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
.\scripts\setup-windows.ps1
```

> **Nota su Windows:** il comando `Set-ExecutionPolicy` è necessario solo la prima volta e permette di eseguire script PowerShell locali. Non abbassa la sicurezza del sistema.

---

Lo script farà automaticamente queste cose per te:

```
[OK] Controlla che Docker, Node e Git siano installati (e li installa se mancano)
[OK] Crea il file .env con una chiave sicura generata casualmente
[OK] Ti chiede solo il tuo indirizzo email
[OK] Avvia il server e la dashboard con Docker
[OK] Installa la CLI tklens
[OK] Aggiunge le variabili di ambiente per Copilot CLI e Claude Code
```

Quando lo script termina vedrai questo messaggio:

```
  ✔  TokenLens setup complete!

  Dashboard  →  http://localhost:3000
  API        →  http://localhost:8080
```

---

## Passo 5 — Apri un nuovo terminale

> ⚠️ **Importante.** Le variabili di ambiente per la raccolta token vengono caricate nel profilo della tua shell. Perché abbiano effetto, devi aprire un **nuovo** terminale (o una nuova finestra PowerShell su Windows).

Su macOS/Linux puoi anche eseguire:
```bash
source ~/.zshrc   # oppure: source ~/.bashrc
```

---

## Passo 6 — Verifica che tutto funzioni

```bash
bash scripts/verify.sh      # macOS e Linux
.\scripts\verify.ps1        # Windows
```

L'output corretto è:

```
  ✔  server container is running
  ✔  frontend container is running
  ✔  API responds at http://localhost:8080/health
  ✔  Dashboard accessible at http://localhost:3000
  ✔  tklens CLI installed
  ✔  tklens is logged in
  ✔  OTel env vars loaded

  All checks passed. TokenLens is ready!
```

Se qualche voce mostra `[XX]`, il messaggio ti dice esattamente cosa fare.

---

## Passo 7 — Usa i tuoi strumenti AI come al solito

Da questo momento **non devi cambiare niente** nel tuo flusso di lavoro.

- Usa **GitHub Copilot CLI** normalmente: i token vengono tracciati in automatico via OpenTelemetry.
- Usa **Claude Code** normalmente: stessa cosa.

Dopo qualche interazione, apri il browser su [http://localhost:3000](http://localhost:3000) e vedrai i dati comparire nella dashboard.

---

## Passo 8 — Raccolta dati automatica (daemon)

Per non dover eseguire `tklens collect` a mano ogni volta, attiva la modalità daemon:

```bash
tklens collect --daemon            # avvia in background, ogni 15 minuti
tklens collect --daemon --interval=30   # ogni 30 minuti
tklens collect --status            # verifica se il daemon è attivo
tklens collect --stop              # ferma il daemon
```

In alternativa, aggiungi una schedulazione permanente:

```bash
tklens collect-schedule            # crontab (macOS/Linux) o Task Scheduler (Windows)
tklens collect-schedule --unschedule
```

Il daemon mantiene tre file in `~/.tklens/`:

| File | Contenuto |
|------|-----------|
| `collect.pid` | PID del processo daemon; rimosso all'arresto |
| `last-collect.json` | `{"timestamp": "<ISO>", "sent": <N>}` aggiornato ogni ciclo |
| `collect.log` | Errori di rete/auth (il daemon non crasha, riprende al ciclo successivo) |

---

## Passo 9 — Esplora il registry delle skill

Il registry include già tre skill pronte all'uso:

| ID | Descrizione |
|----|-------------|
| `mulesoft-api-doc-generator` | Genera documentazione API da spec MuleSoft |
| `java-unit-test-generator` | Genera test JUnit da classi Java |
| `git-commit-message` | Produce messaggi di commit convenzionali |

```bash
# Cerca skill disponibili
tklens search mulesoft

# Dettaglio di una skill
tklens info mulesoft-api-doc-generator

# Aggiungi una skill al progetto corrente (rileva il tuo tool automaticamente)
tklens add mulesoft-api-doc-generator --target=auto

# Altri esempi con le skill seed
tklens add java-unit-test-generator --target=auto
tklens add git-commit-message --target=auto
```

`--target=auto` rileva se stai usando Claude Code (cerca la cartella `.claude/`) o Copilot (cerca `.copilot/`) e materializza la skill nel formato giusto.

---

## Passo 10 — Pubblica una tua skill

Se hai un prompt o una istruzione personalizzata che funziona bene, condividila con il team:

1. Crea una cartella con un file `skill.toml` (vedi `examples/skills/` per esempi)
2. Esegui:

```bash
tklens publish ./mia-skill/
```

La skill sarà subito disponibile nel registry locale per tutti i membri del team.

---

## Aggiornare TokenLens

Quando esce una nuova versione:

```bash
git pull
docker compose up --build -d
npm update -g @tokenlens/cli
```

---

## Fermare e riavviare il server

```bash
# Ferma
docker compose down

# Riavvia (i dati sono preservati nel volume ./data)
docker compose up -d
```

---

## Risoluzione problemi comuni

### Il dashboard non mostra token dopo aver usato lo strumento AI

1. Verifica che le variabili OTel siano caricate nel terminale con cui usi lo strumento:
   ```bash
   echo $OTEL_EXPORTER_OTLP_ENDPOINT   # deve stampare http://localhost:8080/otel
   ```
2. Se è vuoto, apri un nuovo terminale e riprova.
3. Verifica i log del server per vedere se arrivano le richieste:
   ```bash
   docker compose logs -f server
   ```

### `docker compose up` fallisce con "port already in use"

Qualcos'altro usa la porta 8080 o 3000. Puoi cambiare le porte nel file `.env`:
```
SERVER_PORT=8081
FRONTEND_PORT=3001
```
Poi rilancia `docker compose up -d`.

### Windows: "Execution of scripts is disabled"

Esegui questo comando una volta sola in PowerShell come amministratore:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### `tklens: command not found` dopo l'installazione

Il percorso npm globale non è nel PATH. Aggiungi:
```bash
# macOS / Linux
export PATH="$(npm config get prefix)/bin:$PATH"
```
Su Windows, riavvia PowerShell dopo l'installazione.

---

## Configurazione avanzata

### Puntare a un server TokenLens remoto

Se il server gira su una macchina diversa, modifica `.env` nella cartella del progetto:

```
TOKENLENS_ENDPOINT=http://192.168.1.50:8080
```

Poi riesegui il login della CLI:

```bash
tklens login --endpoint http://192.168.1.50:8080 --api-key <your-key>
```

### Usare PostgreSQL invece di SQLite

Per ambienti di produzione o team con più utenti, usa `docker-compose.prod.yml` che configura PostgreSQL:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Vedi [`docker-compose.prod.yml`](./docker-compose.prod.yml) per i parametri di connessione (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`).

### Esporre il server sulla rete locale

Per rendere il server accessibile ad altri dispositivi sulla stessa rete, imposta `HOST` in `.env`:

```
HOST=0.0.0.0
```

Poi rilancia:

```bash
docker compose up -d
```

Il server sarà raggiungibile all'indirizzo IP della tua macchina sulla porta configurata (default 8080).

---

## Autenticazione e rotazione chiave

`tklens login` verifica la chiave contro il server al momento del salvataggio. Se il server non è raggiungibile, la chiave viene salvata con avviso.

**Rotare la chiave (amministratori):**

```http
POST /api/v1/admin/rotate-key
Authorization: Bearer <vecchio-token>

→ {"token": "<nuovo-token>"}
```

Il nuovo token è attivo immediatamente in memoria e viene scritto in `.env`. Aggiorna tutti gli utenti con la nuova chiave.

**Verificare la chiave:**

```http
GET /api/v1/auth/verify
Authorization: Bearer <token>

→ 200 {"valid": true, "user": "service"}
```

---

## Dashboard — filtro utente e pagina per utente

Il dropdown **Utente** nella dashboard (`http://localhost:3000`) filtra tutti i grafici per un singolo utente. Le barre di TopConsumersChart sono cliccabili: portano a `/users/<userId>`.

La pagina `/users/:userId` mostra:
- **Consumi** — trend token ultimi 30 giorni per quell'utente
- **Top tool usati** — breakdown per tool
- **Riepilogo** — KPI cards: token totali, input, output, cache (ultimi 30 giorni e all-time)

---

## Dove andare da qui

- **Dashboard** → [http://localhost:3000](http://localhost:3000)
- **Documentazione API** → [http://localhost:8080/docs](http://localhost:8080/docs) (Swagger UI automatico di FastAPI)
- **Architettura e spec** → [`SPEC.md`](./SPEC.md)
- **Come contribuire** → [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- **Formato delle skill** → [`docs/skill-format.md`](./docs/skill-format.md)
