# Project Echo - Deployment Guide

## Quick Start (Local Development)

```bash
cd app
npm install
node server.js
```

Open http://localhost:3000

---

## Option 1: Docker (Recommended for Self-Hosting)

### Run with Docker Compose

```bash
docker-compose up -d
```

Your data is stored in a Docker volume (`echo_data`).

### Run with Docker directly

```bash
docker build -t project-echo .
docker run -d -p 3000:3000 -v echo_data:/data project-echo
```

---

## Option 2: Desktop PC + Cloudflare Tunnel (Access from Anywhere)

This lets you run Echo on your desktop/home server and access it securely from your phone or any device.

### Prerequisites
- A domain name (can get one for ~$10-15/year)
- Free Cloudflare account
- Your desktop running 24/7 (or whenever you want access)

### Step 1: Add Domain to Cloudflare

1. Sign up at https://cloudflare.com
2. Add your domain and update nameservers at your registrar
3. Wait for DNS propagation (usually a few minutes)

### Step 2: Install cloudflared

**macOS:**
```bash
brew install cloudflared
```

**Linux:**
```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
```

**Windows:**
Download from https://github.com/cloudflare/cloudflared/releases

### Step 3: Login to Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser to authorize.

### Step 4: Create a Tunnel

```bash
cloudflared tunnel create echo
```

Note the tunnel ID that's printed.

### Step 5: Configure the Tunnel

Create `~/.cloudflared/config.yml`:

```yaml
tunnel: <YOUR-TUNNEL-ID>
credentials-file: /path/to/.cloudflared/<TUNNEL-ID>.json

ingress:
  - hostname: echo.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

### Step 6: Create DNS Record

```bash
cloudflared tunnel route dns echo echo.yourdomain.com
```

### Step 7: Start the Tunnel

```bash
# Start Project Echo
cd /path/to/project_echo/app
node server.js &

# Start the tunnel
cloudflared tunnel run echo
```

Now access your app at https://echo.yourdomain.com from anywhere!

### Step 8: Run as Service (Optional)

**macOS (launchd):**
```bash
sudo cloudflared service install
```

**Linux (systemd):**
```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

---

## Option 3: Tailscale (Private Network Only)

If you only need access from your own devices (most private option):

### Step 1: Install Tailscale

Install on your desktop and all devices: https://tailscale.com/download

### Step 2: Run Project Echo

```bash
cd app
node server.js
```

### Step 3: Access via Tailscale IP

Find your desktop's Tailscale IP (looks like `100.x.x.x`) and access:
```
http://100.x.x.x:3000
```

No public exposure, end-to-end encrypted.

---

## Adding Authentication (Cloudflare Access)

Protect your tunnel with free authentication:

1. Go to Cloudflare Zero Trust dashboard
2. Access > Applications > Add an application
3. Choose "Self-hosted"
4. Set application domain: `echo.yourdomain.com`
5. Add authentication policy (email, Google, GitHub, etc.)

Now users must authenticate before reaching your app.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DATA_DIR` | `./` (app dir) | Where to store logs.jsonl |

---

## Data Location

- **Local dev**: `app/logs.jsonl`
- **Docker**: `/data/logs.jsonl` (in `echo_data` volume)
- **Custom**: Set `DATA_DIR` environment variable

### Backup Your Data

**Docker:**
```bash
docker cp $(docker-compose ps -q echo):/data/logs.jsonl ./backup-logs.jsonl
```

**Direct:**
```bash
cp $DATA_DIR/logs.jsonl ./backup-logs.jsonl
```
