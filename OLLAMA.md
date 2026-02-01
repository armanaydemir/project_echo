# Ollama Server Management (macOS)

## Installation

```bash
brew install ollama
```

## Starting the Server

```bash
# Run in foreground
ollama serve

# Or run as a background service
brew services start ollama
```

## Stopping the Server

```bash
# If running as a service
brew services stop ollama

# If running in foreground, use Ctrl+C
```

## Check Server Status

```bash
# Check if running
curl http://localhost:11434/api/tags

# Or via brew services
brew services list | grep ollama
```

## Managing Models

```bash
# List installed models
ollama list

# Pull a model
ollama pull llama3.2

# Remove a model
ollama rm <model-name>

# Show model details
ollama show <model-name>
```

## Recommended Models for 24GB RAM Mac

| Model | Size | RAM Usage | Notes |
|-------|------|-----------|-------|
| `llama3.2` | 3B | ~2GB | Fast, lightweight |
| `llama3.1:8b` | 8B | ~5GB | Good balance |
| `llama2:13b` | 13B | ~8GB | Largest Llama for 24GB |
| `qwen2.5:14b` | 14B | ~9GB | Best quality for 24GB |
| `deepseek-r1:14b` | 14B | ~9GB | Strong reasoning |
| `gpt-oss:latest` | 22B | ~13GB | Large, pushes 24GB limit |

```bash
# Pull recommended model
ollama pull qwen2.5:14b
```

## Finding More Models

Browse the full model library at https://ollama.com/library

```bash
# Show info about a model (after pulling)
ollama show <model-name>

# Try pulling a model directly
ollama pull <model-name>
```

## Default Configuration

- **Host:** http://localhost:11434
- **Model used by Echo:** llama3.2 (configurable via `OLLAMA_MODEL` env var)

## Troubleshooting

### Port already in use
```bash
# Find what's using port 11434
lsof -i :11434

# Kill the process if needed
kill -9 <PID>
```

### Server not responding
```bash
# Restart the service
brew services restart ollama
```
