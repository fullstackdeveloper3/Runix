// server.js
require('dotenv').config(); // Loads .env file secrets
const express = require('express');
const fs = require('fs');
const path = require('path');
const sanitize = require('sanitize-filename');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai'); // Import the new OpenAI package

const app = express();
const STORAGE_DIR = path.join(__dirname, 'saved_files');
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

// --- OpenAI Setup ---
// Check if the key is loaded
if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY not found.");
  console.log("Please create a .env file and add OPENAI_API_KEY=your_key");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.static('public'));
app.use(bodyParser.json({ limit: '5mb' }));

app.post('/api/save', (req, res) => {
  try {
    const { filename, content, autosave } = req.body;
    if (!filename || typeof content !== 'string') return res.status(400).send('Invalid payload');
    const safe = sanitize(filename);
    const timestamp = (new Date()).toISOString().replace(/[:.]/g,'-');
    const base = path.join(STORAGE_DIR, safe);
    const versioned = base + `.${timestamp}.bak`;
    fs.writeFileSync(base, content, 'utf8');
    fs.writeFileSync(versioned, content, 'utf8');
    console.log(`Saved ${safe} (autosave=${!!autosave})`);
    res.json({ ok: true, filename: safe });
  } catch (e) {
    console.error(e);
    res.status(500).send('Error saving file: ' + e.message);
  }
});

app.post('/api/ask', async (req, res) => {
  try {
    const { question, code } = req.body;
    if (!question) {
      return res.status(400).json({ answer: "No question provided." });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {role: "system", content: "You are Runix AI Assistant. A helpful, skilled coding assistant."},
        {role: "user", content: question + "\n\nUser's current code:\n" + code}
      ]
    });

    const answer = completion.choices?.[0]?.message?.content || "No response from AI.";
    res.json({ answer });

  } catch (e) {
    console.error(e);
    res.status(500).json({ answer: 'Server error: ' + e.message });
  }
});

const tryPorts = [5000, 5001, 5002, 5003, 5004];
function startServer(index = 0) {
  if (index >= tryPorts.length) { console.error('No ports available'); process.exit(1); }
  const PORT = tryPorts[index];

app.post('/api/speak', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).send('No text provided');
    }

    
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",     
      voice: "alloy",      
      input: text,
      response_format: "mp3",
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    const buffer = Buffer.from(await mp3.arrayBuffer());
    res.send(buffer);

  } catch (e) {
    console.error("Error in /api/speak:", e);
    res.status(500).json({ error: 'Server error: ' + e.message });
  }
});

  const server = app.listen(PORT, () => console.log('Server running on http://localhost:' + PORT));
  server.on('error', (err) => { if (err.code === 'EADDRINUSE') { console.log('Port ' + PORT + ' in use, trying next'); startServer(index + 1); } else { console.error(err); process.exit(1); } });
}
startServer();