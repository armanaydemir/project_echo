# Project Echo - Deployment Guide

## Local Development

```bash
cd app
npm install
npm install -g pm2
PORT=3001 pm2 start server.js --name echo-dev
```

Open http://localhost:3001

> **Note:** Dev uses port 3001 to avoid conflicts with production (port 3000).

---

## Production Deployment with Tailscale

Access Echo securely from your phone or any device on your private network. No public exposure, end-to-end encrypted.

### Step 1: Install Tailscale

Install on your server and all devices you want to access it from: https://tailscale.com/download

### Step 2: Install pm2

pm2 is a process manager that keeps your app running after SSH disconnects.

```bash
npm install -g pm2
```

### Step 3: Start Project Echo

```bash
cd app
pm2 start server.js --name echo
```

### Step 4: Enable persistence (production only)

This ensures the app restarts automatically after server reboots.

```bash
pm2 save
pm2 startup
```

`pm2 startup` will print a command you need to run with sudo - copy and run it.

### Step 5: Access via Tailscale IP

Find your server's Tailscale IP (looks like `100.x.x.x`) in the Tailscale admin console or by running `tailscale ip` on the server.

Access your app at:
```
http://100.x.x.x:3000
```

### Useful pm2 Commands

```bash
pm2 status          # Check if app is running
pm2 logs echo       # View logs
pm2 restart echo    # Restart the app
pm2 stop echo       # Stop the app
```

---

## Ollama Integration

Project Echo can use Ollama for local LLM inference.

### Prerequisites

1. **Install Ollama**: Download from https://ollama.ai
2. **Pull a model**:
   ```bash
   ollama pull llama3.2
   ```
3. **Ensure Ollama is running**:
   ```bash
   ollama serve
   ```
   Ollama runs on `http://localhost:11434` by default.

### Configuration

Set these environment variables to configure Ollama:

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `llama3.2` | Model to use for inference |

### Docker Note

When running Project Echo in Docker, the container needs to reach Ollama running on the host machine.

**macOS / Windows:**
Docker Desktop automatically resolves `host.docker.internal` to the host machine. The `docker-compose.yml` is pre-configured with `OLLAMA_HOST=http://host.docker.internal:11434`.

**Linux:**
Linux requires the `extra_hosts` mapping to resolve `host.docker.internal`. This is included in the `docker-compose.yml`:

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

If running with `docker run` directly on Linux, add the flag:
```bash
docker run -d -p 3000:3000 --add-host=host.docker.internal:host-gateway \
  -e OLLAMA_HOST=http://host.docker.internal:11434 \
  -e OLLAMA_MODEL=llama3.2 \
  -v echo_data:/data project-echo
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATA_DIR` | `./` (app dir) | Where to store logs.jsonl |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API endpoint |
| `OLLAMA_MODEL` | `llama3.2` | Ollama model to use |

---

## Data Location

- **Local dev**: `app/logs.jsonl` and `app/tags.json`
- **Custom**: Set `DATA_DIR` environment variable

### Data Files

| File | Description |
|------|-------------|
| `logs.jsonl` | All log entries with content, tags, timestamps, and version history |
| `tags.json` | Known tags list for autocomplete |

### Backup Your Data

```bash
cp app/logs.jsonl ./backup-logs.jsonl
cp app/tags.json ./backup-tags.json
```
