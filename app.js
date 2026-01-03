/* ____________________________________Ruinix Code_________________________________
1_monaco
2_constants
3-function 
4-save
5-download
6-run code
7-send question
8-microphone
9-autosave
*/

let editor;
require.config({ paths: { 'vs': 'https://unpkg.com/monaco-editor@0.34.1/min/vs' }});
require(['vs/editor/editor.main'], function() {
  editor = monaco.editor.create(document.getElementById('editor'), {
    value: '// Welcome to Runix CodeTalk\nconsole.log("Hello, Runix!");',
    language: 'javascript',
    theme: 'vs-dark',
    automaticLayout: true
  });
});

const filenameInput = document.getElementById('filename');
const langSelect = document.getElementById('langSelect');
const chat = document.getElementById('chat');
const consoleOutput = document.getElementById('consoleOutput');

function appendChat(text, who='ai') {
  const d = document.createElement('div');
  d.className = 'msg ' + (who==='user' ? 'user' : 'ai');
  d.textContent = text;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
  if (who==='ai') speakText(text);
}

async function speakText(text) {
  window.speechSynthesis.cancel(); 

  try {
    const response = await fetch('/api/speak', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: text })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch audio from server.');
    }

    const blob = await response.blob();
    const audioUrl = URL.createObjectURL(blob);

    const audio = new Audio(audioUrl);
    audio.play();

  } catch (err) {
    console.error("Error playing audio:", err);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    window.speechSynthesis.speak(utterance);
  }
}

function extFromLang(l) {
  return { javascript:'js', html:'html', css:'css', python:'py', cpp:'cpp' }[l] || 'txt';
}

document.getElementById('saveBtn')?.addEventListener('click', ()=>{
  const content = editor.getValue();
  const filename = (filenameInput.value || 'project') + '.' + extFromLang(langSelect.value);
  fetch('/api/save', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({filename, content})
  }).then(()=> alert('Saved to server!'))
  .catch(()=> alert('Save failed'));
});

document.getElementById('downloadBtn').addEventListener('click', ()=>{
  const blob = new Blob([editor.getValue()], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (filenameInput.value || 'project') + '.' + extFromLang(langSelect.value);
  a.click();
});

document.getElementById('runBtn').addEventListener('click', async ()=>{
  const lang = langSelect.value;
  const code = editor.getValue();
  
  if (lang === 'html' || lang === 'css' || lang === 'javascript') {
    const previewFrame = document.getElementById('previewFrame'); 
    
    const htmlContent = `
      <html>
        <head>
          ${lang === 'css' ? `<style>${code}</style>` : ''}
        </head>
        <body>
          ${lang === 'html' ? code : ''}
          ${lang === 'javascript' ? `<script>${code}</script>` : ''}
        </body>
      </html>
    `;
    previewFrame.srcdoc = htmlContent;
    consoleOutput.textContent = "Rendering Web preview...";
  } else {
    consoleOutput.textContent = "Running " + lang + "...\n";

    try {
      const res = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          language: lang,
          version: '*',
          files: [{ content: code }]
        })
      });
      const data = await res.json();
      consoleOutput.textContent += data.run.output || '(no output)';
    } catch (err) {
      consoleOutput.textContent = 'Error: ' + err.message;
    }
  }
});

document.getElementById('askBtn').addEventListener('click', sendQuestion);
document.getElementById('userQuestion').addEventListener('keydown', (e)=>{
  if(e.key==='Enter') sendQuestion();
});

async function sendQuestion(){
  const q = document.getElementById('userQuestion').value.trim();
  if(!q) return;

  appendChat(q, 'user');
  document.getElementById('userQuestion').value = '';

  const chatHistory = getChatHistory(); 
  const API_URL = "/api/ask"; 
  
  const payload = {
    history: chatHistory, 
    code: editor.getValue(),
    question: q 
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    appendChat(data.answer || "No response", 'ai');
  } catch {
    appendChat("AI Error: Unable to connect to server", 'ai');
  }
}

let recognition;
document.getElementById('micBtn').addEventListener('click', ()=>{
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRecognition){ alert('Your browser does not support SpeechRecognition'); return; }

  const micButton = document.getElementById('micBtn');

  if (recognition && recognition.isListening) {
    recognition.stop();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'en-us'; 
  recognition.isListening = false;

  recognition.onstart = () => {
    recognition.isListening = true;
    micButton.classList.add('listening'); 
  };

  recognition.onend = () => {
    recognition.isListening = false;
    micButton.classList.remove('listening'); 
  };

  recognition.onresult = (e)=>{
    const t = e.results[0][0].transcript;
    document.getElementById('userQuestion').value = t;
    sendQuestion();
  };

  recognition.start(); 
});

setInterval(() => {
  const content = editor.getValue();
  const filename = (filenameInput.value || 'project') + '.' + extFromLang(langSelect.value);

  fetch('/api/save', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({filename, content, autosave: true})
  }).then(res => res.json())
    .then(data => console.log('Autosaved ' + data.filename))
    .catch(err => console.error('Autosave failed', err));
}, 5000); 

function getChatHistory() {
  const history = [];
  const messages = document.querySelectorAll('#chat .msg'); 

  messages.forEach(msg => {
    if (msg.classList.contains('ai-typing')) return; 

    const role = msg.classList.contains('user') ? 'user' : 'assistant';
    const content = msg.textContent;
    history.push({ role, content });
  });
  return history;
}

function langFromExt(ext) {
  const map = {
    'js': 'javascript',
    'html': 'html',
    'css': 'css',
    'py': 'python',
    'cpp': 'cpp',
    'txt': 'plaintext'
  };
  return map[ext] || 'plaintext';
}

const openBtn = document.getElementById('openBtn');
const fileInput = document.getElementById('fileInput');

openBtn.addEventListener('click', () => {
  fileInput.click(); 
});

fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return; 

  const reader = new FileReader();
  
  reader.onload = (e) => {
    const content = e.target.result;
    
    editor.setValue(content);

    const parts = file.name.split('.');
    const extension = parts.pop().toLowerCase();
    const name = parts.join('.'); 
    filenameInput.value = name;

    const language = langFromExt(extension);
    langSelect.value = language;

    monaco.editor.setModelLanguage(editor.getModel(), language);
  };

  reader.readAsText(file); 
  
  event.target.value = null;
});