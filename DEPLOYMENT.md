# Project Echo - Deployment Guide

This branch (`cloudflare`) uses **Cloudflare Workers + D1** for serverless deployment.

For the self-hosted version (Docker, local), see the `main` branch.

---

## Cloudflare Workers Deployment

### What's Different in This Branch

| Component | Main Branch | Cloudflare Branch |
|-----------|-------------|-------------------|
| Runtime | Node.js + Express | Cloudflare Workers |
| Storage | JSONL file | D1 (SQLite) |
| Hosting | Self-hosted | Cloudflare edge (global) |
| Cost | Your server | Free tier (generous) |

### Free Tier Limits

- **Workers**: 100,000 requests/day
- **D1 Reads**: 5 million/day
- **D1 Writes**: 100,000/day
- **D1 Storage**: 5 GB

For personal use: **permanently free**.

---

## Quick Start

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

### 3. Create D1 Database

```bash
wrangler d1 create project-echo-db
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "project-echo-db"
database_id = "YOUR_DATABASE_ID_HERE"
```

### 4. Run Database Migration

```bash
wrangler d1 execute project-echo-db --remote --file=./migrations/0001_create_logs.sql
```

### 5. Install Dependencies

```bash
npm install
```

### 6. Local Development

```bash
npm run dev
```

Opens at http://localhost:8787

### 7. Deploy to Production

```bash
npm run deploy
```

Your app is now live at `https://project-echo.<your-subdomain>.workers.dev`

---

## Custom Domain (Optional)

1. Go to Cloudflare dashboard → Workers & Pages → your worker
2. Click "Custom Domains" tab
3. Add your domain (must be on Cloudflare DNS)

---

## Migrating Existing Data

If you have logs in `logs.jsonl` from the main branch:

```bash
# Generate SQL from JSONL
node scripts/migrate-jsonl-to-d1.js ./path/to/logs.jsonl > migration-data.sql

# Import to D1
wrangler d1 execute project-echo-db --remote --file=./migration-data.sql
```

---

## For Others to Deploy Their Own Instance

1. Fork this repo
2. Create free Cloudflare account at https://cloudflare.com
3. Run:

```bash
npm install -g wrangler
wrangler login
wrangler d1 create project-echo-db
# Update wrangler.toml with your database_id
npm install
wrangler d1 execute project-echo-db --remote --file=./migrations/0001_create_logs.sql
npm run deploy
```

Done. Each person gets their own isolated database.

---

## Adding Authentication

Protect your app with Cloudflare Access (free):

1. Go to Cloudflare Zero Trust dashboard
2. Access → Applications → Add application
3. Choose "Self-hosted"
4. Set domain: `project-echo.<subdomain>.workers.dev`
5. Add policy: Allow emails ending in `@yourdomain.com` (or specific emails)

Now only authenticated users can access.

---

## Project Structure

```
project-echo/
├── src/
│   └── index.ts          # Worker code (no framework)
├── public/
│   └── index.html        # Frontend (same as main branch)
├── migrations/
│   └── 0001_create_logs.sql
├── scripts/
│   └── migrate-jsonl-to-d1.js
├── wrangler.toml         # Cloudflare config
├── package.json
└── tsconfig.json
```

---

## D1 Database Schema

```sql
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  is_private INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
```

Simple. One table, queryable with SQL.

---

## LLM Processing (Future)

Since this runs serverless, local Ollama isn't possible. For LLM features:

- Use cloud APIs (Anthropic, OpenAI, etc.)
- Store API key as a secret: `wrangler secret put ANTHROPIC_API_KEY`
- Access in code via `env.ANTHROPIC_API_KEY`

**Recommended**: Anthropic Claude API (no training on API data, good privacy).

---

## Comparison: When to Use Which Branch

| Use Case | Branch |
|----------|--------|
| Run on your own PC/server | `main` |
| Access from phone without dedicated server | `cloudflare` |
| Maximum privacy (data on your machine) | `main` + Cloudflare Tunnel |
| Zero maintenance, global edge | `cloudflare` |
| Run local Ollama for LLM | `main` |
| Use cloud LLM APIs | Either (cloudflare easier) |
