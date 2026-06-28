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

## Passo 2 — Esegui lo script di setup automatico

Scegli il comando in base al tuo sistema operativo.

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

## Passo 3 — Apri un nuovo terminale

> ⚠️ **Importante.** Le variabili di ambiente per la raccolta token vengono caricate nel profilo della tua shell. Perché abbiano effetto, devi aprire un **nuovo** terminale (o una nuova finestra PowerShell su Windows).

Su macOS/Linux puoi anche eseguire:
```bash
source ~/.zshrc   # oppure: source ~/.bashrc
```

---

## Passo 4 — Verifica che tutto funzioni

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

## Passo 5 — Usa i tuoi strumenti AI come al solito

Da questo momento **non devi cambiare niente** nel tuo flusso di lavoro.

- Usa **GitHub Copilot CLI** normalmente: i token vengono tracciati in automatico via OpenTelemetry.
- Usa **Claude Code** normalmente: stessa cosa.

Dopo qualche interazione, apri il browser su [http://localhost:3000](http://localhost:3000) e vedrai i dati comparire nella dashboard.

---

## Passo 6 — Esplora il registry delle skill

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

## Passo 7 — Pubblica una tua skill

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

## Dove andare da qui

- **Dashboard** → [http://localhost:3000](http://localhost:3000)
- **Documentazione API** → [http://localhost:8080/docs](http://localhost:8080/docs) (Swagger UI automatico di FastAPI)
- **Architettura e spec** → [`SPEC.md`](./SPEC.md)
- **Come contribuire** → [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- **Formato delle skill** → [`docs/skill-format.md`](./docs/skill-format.md)
