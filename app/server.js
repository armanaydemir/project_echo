const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || __dirname;
const LOGS_FILE = path.join(DATA_DIR, 'logs.jsonl');
const TAGS_FILE = path.join(DATA_DIR, 'tags.json');
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

// Default tag for new logs
const DEFAULT_TAG = 'needs review';

// Available models (add new models here)
const MODELS = {
  'llama3.2': { name: 'Llama 3.2', size: '3B', ram: '~2GB' },
  'llama3.1:8b': { name: 'Llama 3.1', size: '8B', ram: '~5GB' },
  'llama2:13b': { name: 'Llama 2', size: '13B', ram: '~8GB' },
  'qwen2.5:14b': { name: 'Qwen 2.5', size: '14B', ram: '~9GB' },
  'deepseek-r1:14b': { name: 'DeepSeek R1', size: '14B', ram: '~9GB' },
  'gpt-oss:latest': { name: 'GPT-OSS', size: '22B', ram: '~13GB' },
};

const DEFAULT_MODEL = 'gpt-oss:latest';
let currentModel = process.env.currentModel || DEFAULT_MODEL;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve chat page at /chat
app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Serve all pages list at /all
app.get('/all', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'all.html'));
});

// Serve logs table page at /logs-table
app.get('/logs-table', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'logs-table.html'));
});

// Generate unique ID for logs
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Read all logs from file
function readLogs() {
  if (!fs.existsSync(LOGS_FILE)) {
    return [];
  }
  const data = fs.readFileSync(LOGS_FILE, 'utf8');
  return data
    .trim()
    .split('\n')
    .filter(line => line)
    .map(line => JSON.parse(line));
}

// Write all logs to file
function writeLogs(logs) {
  const data = logs.map(log => JSON.stringify(log)).join('\n') + '\n';
  fs.writeFileSync(LOGS_FILE, data);
}

// Read known tags from file
function readTags() {
  if (!fs.existsSync(TAGS_FILE)) {
    return [DEFAULT_TAG];
  }
  try {
    const data = JSON.parse(fs.readFileSync(TAGS_FILE, 'utf8'));
    return data.tags || [DEFAULT_TAG];
  } catch (e) {
    return [DEFAULT_TAG];
  }
}

// Write known tags to file
function writeTags(tags) {
  fs.writeFileSync(TAGS_FILE, JSON.stringify({ tags }, null, 2));
}

// Add new tags to known tags list
function addKnownTags(newTags) {
  const knownTags = readTags();
  const updated = [...new Set([...knownTags, ...newTags])];
  writeTags(updated);
  return updated;
}

// Migrate old logs without ID or tags, and convert private boolean to tag
function migrateLogs(logs) {
  let needsWrite = false;
  const migrated = logs.map(log => {
    let changed = false;
    if (!log.id) {
      log.id = generateId();
      changed = true;
    }
    if (!log.tags) {
      log.tags = [DEFAULT_TAG];
      changed = true;
    }
    // Migrate private boolean to tag
    if (log.private === true && !log.tags.includes('private')) {
      log.tags.push('private');
      changed = true;
    }
    // Remove old private field
    if ('private' in log) {
      delete log.private;
      changed = true;
    }
    if (changed) needsWrite = true;
    return log;
  });
  if (needsWrite) {
    writeLogs(migrated);
  }
  return migrated;
}

// Helper function to get non-private logs
function getNonPrivateLogs() {
  const logs = migrateLogs(readLogs());
  return logs
    .filter(log => !log.tags || !log.tags.includes('private'))
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

// Helper function to format logs as context
function formatLogsAsContext(logs) {
  if (logs.length === 0) {
    return 'No logs available.';
  }
  return logs.map(log => {
    const date = new Date(log.timestamp);
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    return `[${dateStr}]\n${log.content}`;
  }).join('\n\n---\n\n');
}

// POST /logs - Save a log entry
app.post('/logs', (req, res) => {
  const { content, private: isPrivate, tags } = req.body;
  let entryTags = tags && tags.length > 0 ? [...tags] : [DEFAULT_TAG];

  // Handle private as a tag
  if (isPrivate && !entryTags.includes('private')) {
    entryTags.push('private');
  }

  const entry = {
    id: generateId(),
    content,
    tags: entryTags,
    timestamp: new Date().toISOString()
  };
  fs.appendFileSync(LOGS_FILE, JSON.stringify(entry) + '\n');
  // Track any new tags (except private)
  const tagsToTrack = entry.tags.filter(t => t !== 'private');
  if (tagsToTrack.length > 0) {
    addKnownTags(tagsToTrack);
  }
  res.json(entry);
});

// GET /logs - Return all logs
app.get('/logs', (req, res) => {
  const logs = readLogs();
  // Migrate old logs without ID/tags
  const migrated = migrateLogs(logs);
  res.json(migrated);
});

// PUT /logs/:id - Update a log entry (tags, content, private)
app.put('/logs/:id', (req, res) => {
  const { id } = req.params;
  const { content, private: isPrivate, tags } = req.body;

  const logs = migrateLogs(readLogs());
  const index = logs.findIndex(log => log.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Log not found' });
  }

  const log = logs[index];

  // Track version history if content changed
  if (content !== undefined && content !== log.content) {
    if (!log.versions) {
      log.versions = [];
    }
    log.versions.push({
      content: log.content,
      editedAt: log.editedAt || log.timestamp
    });
    log.content = content;
    log.editedAt = new Date().toISOString();
  }

  // Update tags
  if (tags !== undefined) {
    log.tags = [...tags];
    // Track tags (except private)
    const tagsToTrack = tags.filter(t => t !== 'private');
    if (tagsToTrack.length > 0) {
      addKnownTags(tagsToTrack);
    }
  }

  // Handle private as a tag
  if (isPrivate !== undefined) {
    if (isPrivate && !log.tags.includes('private')) {
      log.tags.push('private');
    } else if (!isPrivate && log.tags.includes('private')) {
      log.tags = log.tags.filter(t => t !== 'private');
    }
  }

  logs[index] = log;
  writeLogs(logs);

  res.json(log);
});

// GET /api/tags - Get all known tags for autocomplete
app.get('/api/tags', (req, res) => {
  const tags = readTags();
  res.json({ tags });
});

// POST /api/tags - Add a new tag
app.post('/api/tags', (req, res) => {
  const { tag } = req.body;
  if (!tag || typeof tag !== 'string') {
    return res.status(400).json({ error: 'Tag is required' });
  }
  const trimmed = tag.trim().toLowerCase();
  if (!trimmed) {
    return res.status(400).json({ error: 'Tag cannot be empty' });
  }
  const tags = addKnownTags([trimmed]);
  res.json({ tags });
});

// GET /api/models - List available models from Ollama
app.get('/api/models', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`);
    if (response.ok) {
      const data = await response.json();
      const models = (data.models || []).map(m => ({
        id: m.name,
        name: m.name,
        size: m.details?.parameter_size || 'Unknown',
        active: m.name === currentModel
      }));
      res.json({ models, active: currentModel });
    } else {
      res.status(503).json({ error: 'Failed to fetch models from Ollama' });
    }
  } catch (e) {
    res.status(503).json({ error: 'Ollama is not running' });
  }
});

// POST /api/models - Switch active model
app.post('/api/models', (req, res) => {
  const { model } = req.body;
  if (!model) {
    return res.status(400).json({ error: 'Model is required' });
  }
  currentModel = model;
  res.json({ active: currentModel });
});

// GET /api/ollama/status - Check if Ollama is running
app.get('/api/ollama/status', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    if (response.ok) {
      const data = await response.json();
      res.json({ status: 'running', models: data.models || [] });
    } else {
      res.status(503).json({ status: 'error', message: 'Ollama returned an error' });
    }
  } catch (error) {
    if (error.name === 'TimeoutError') {
      res.status(503).json({ status: 'error', message: 'Ollama request timed out' });
    } else {
      res.status(503).json({ status: 'error', message: 'Ollama is not running' });
    }
  }
});

// POST /api/chat - Chat with Ollama using logs as context (streaming)
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Get non-private logs and format as context
    const logs = getNonPrivateLogs();
    const logsContext = formatLogsAsContext(logs);

    // Build system prompt with logs context
    const systemPrompt = `You are Echo, a helpful AI assistant with access to the user's personal logs. Use these logs as context to provide personalized and relevant responses.

Here are the user's logs:

${logsContext}

When responding:
- Reference specific logs when relevant
- Be helpful and conversational
- If asked about something not in the logs, be honest about it
- Respect the user's privacy and be thoughtful in your responses`;

    // Set up SSE headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Call Ollama API with streaming enabled
    const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: currentModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        stream: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${errorText}`);
    }

    // Stream the response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.message?.content) {
            res.write(`data: ${JSON.stringify({ content: data.message.content })}\n\n`);
          }
          if (data.done) {
            res.write(`data: ${JSON.stringify({ done: true, model: currentModel })}\n\n`);
          }
        } catch (e) {
          // Skip malformed JSON lines
        }
      }
    }

    res.end();
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') {
      res.status(503).json({ error: 'Ollama is not running. Please start Ollama and try again.' });
    } else {
      console.error('Chat error:', error);
      res.status(500).json({ error: error.message || 'Failed to get response from Ollama' });
    }
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
