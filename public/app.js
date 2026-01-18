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
  // Add this inside the require(...) block after creating 'editor'
editor.addAction({
  id: 'explain-selection',
  label: 'Runix: Explain this block',
  contextMenuGroupId: 'navigation',
  contextMenuOrder: 1.5,
  run: async function(ed) {
    const selection = ed.getModel().getValueInRange(ed.getSelection());
    if (!selection.trim()) return;

    appendChat(`Explain this code: \n"${selection.substring(0, 50)}..."`, 'user');
    
    // Send just the selection to your existing API
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: [], 
          code: selection, // Only send the highlighted part
          question: "Explain this specific code snippet briefly."
        })
      });
      const data = await res.json();
      appendChat(data.answer || "No response.", 'ai');
    } catch (err) {
      appendChat("Error connecting to AI.", 'ai');
    }
  }
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

// Inside app.js

// 1. Get the new button
const complexityBtn = document.getElementById('complexityBtn');

// 2. Add the click event listener
complexityBtn?.addEventListener('click', async () => {
  const code = editor.getValue();
  
  // Basic validation
  if (!code.trim()) {
    alert("Please write some code first!");
    return;
  }

  // 3. Define the specific prompt for complexity
  const prompt = "Analyze the time complexity of this code. Please provide: \n1. Big O (Worst Case)\n2. Omega (Best Case)\n3. Theta (Average/Tight Case)\nBriefly explain why.";

  // 4. Show the question in the chat UI so the user knows it's processing
  appendChat("Checking Time Complexity...", 'user');

  // 5. Reuse the existing /api/ask endpoint
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: [], // We don't necessarily need history for this specific check
        code: code,
        question: prompt
      })
    });

    const data = await res.json();
    
    // 6. Display the result in the AI chat
    appendChat(data.answer || "Could not determine complexity.", 'ai');
    
  } catch (err) {
    console.error(err);
    appendChat("Error: Could not connect to AI server to check complexity.", 'ai');
  }
});
// --- Complexity Analysis Features ---

async function checkComplexity(type, symbol) {
  const code = editor.getValue();
  if (!code.trim()) {
    alert("Please write some code first!");
    return;
  }

  // Define a prompt specifically asking for equations
  const prompt = `Analyze the time complexity of the provided code. 
  Provide the **${type} Time Complexity** represented by the symbol ${symbol}.
  
  Please format the answer using mathematical equations (e.g., ${symbol}(n) = n^2). 
  Keep the explanation brief.`;

  appendChat(`Calculating ${type} (${symbol})...`, 'user');

  // Reuse the existing API endpoint
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: [], 
        code: code,
        question: prompt
      })
    });
    
    const data = await res.json();
    appendChat(data.answer || "No response found.", 'ai');
    
  } catch (err) {
    console.error(err);
    appendChat("Error: Could not connect to server.", 'ai');
  }
}

// Attach listeners to the new buttons
document.getElementById('btnBigO')?.addEventListener('click', () => {
  checkComplexity("Worst Case", "O");
});

document.getElementById('btnOmega')?.addEventListener('click', () => {
  checkComplexity("Best Case", "Ω");
});

document.getElementById('btnTheta')?.addEventListener('click', () => {
  checkComplexity("Average/Tight Case", "Θ");
});
// --- Complexity Analysis Logic ---

const complexitySelect = document.getElementById('complexitySelect');

complexitySelect?.addEventListener('change', async function() {
  const symbol = this.value; // Gets "O", "Omega", or "Theta"
  const code = editor.getValue();

  // 1. Reset the dropdown back to "Complexity" title so it can be used again
  this.value = ""; 

  if (!code.trim()) {
    alert("Please write some code first!");
    return;
  }

  // 2. Map the symbol to a readable description for the prompt
  let typeDescription = "";
  if (symbol === "O") typeDescription = "Worst Case (Big O)";
  if (symbol === "Omega") typeDescription = "Best Case (Omega)";
  if (symbol === "Theta") typeDescription = "Average/Tight Case (Theta)";

  // 3. Create the prompt
  const prompt = `Analyze the time complexity of the provided code. 
  Provide the **${typeDescription}** represented by the symbol ${symbol}.
  Please format the answer using mathematical equations (e.g., ${symbol}(n) = n^2).`;

  // 4. Show user request in chat
  appendChat(`Checking ${symbol} complexity...`, 'user');

  // 5. Send to AI
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: [], 
        code: code,
        question: prompt
      })
    });
    
    const data = await res.json();
    appendChat(data.answer || "No response.", 'ai');
    
  } catch (err) {
    console.error(err);
    appendChat("Error: Could not connect to server.", 'ai');
  }
});
document.getElementById('formatBtn')?.addEventListener('click', () => {
  editor.trigger('anyString', 'editor.action.formatDocument');
});

const themeToggle = document.getElementById('themeToggle');
let isLight = false;

themeToggle?.addEventListener('click', () => {
  isLight = !isLight;
  document.body.classList.toggle('light-mode');
  
  // Switch Monaco Theme between 'vs-dark' and 'vs' (light)
  monaco.editor.setTheme(isLight ? 'vs' : 'vs-dark');
});
// Open AST Visualizer
document.getElementById('astBtn')?.addEventListener('click', async () => {
  const code = editor.getValue();
  if (!code.trim()) return;

  const astPanel = document.getElementById('astVisualizer');
  const astGraph = document.getElementById('astGraph');
  
  // 1. Show the panel
  astPanel.style.display = 'flex';
  editor.layout(); // Tell Monaco to resize itself to fit the new smaller space

  // 2. Show loading state
  astGraph.innerHTML = '<div style="color:#aaa; text-align:center; margin-top:20px;">Generating Tree... <i class="fa-solid fa-spinner fa-spin"></i></div>';

  // 3. Ask AI for Mermaid JS Graph syntax
  const prompt = `Generate a Mermaid.js flowchart (graph TD) representing the Abstract Syntax Tree (AST) of this code. 
  - Use "graph TD".
  - Do NOT include markdown code blocks (no \`\`\`).
  - Keep node labels simple.
  - Return ONLY the Mermaid code string.
  Code:
  ${code}`;

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: [], 
        code: code,
        question: prompt
      })
    });
    const data = await res.json();
    
    // 4. Render the graph
    let graphDefinition = data.answer;
    
    // Clean up if AI added markdown backticks by mistake
    graphDefinition = graphDefinition.replace(/```mermaid/g, '').replace(/```/g, '').trim();

    astGraph.innerHTML = graphDefinition;
    
    // Mermaid render function
    await mermaid.render('mermaid-svg-id', graphDefinition).then(({ svg }) => {
        astGraph.innerHTML = svg;
    });

  } catch (err) {
    console.error(err);
    astGraph.innerHTML = '<div style="color:red;">Error generating visualizer.</div>';
  }
});

// Close AST Visualizer
document.getElementById('closeAstBtn')?.addEventListener('click', () => {
  const astPanel = document.getElementById('astVisualizer');
  astPanel.style.display = 'none';
  editor.layout(); // Tell Monaco to expand back to full size
});

// --- Code Translator Feature ---

const translateBtn = document.getElementById('translateBtn');
const translatorPanel = document.getElementById('translatorPanel');
const closeTranslateBtn = document.getElementById('closeTranslateBtn');
const doTranslateBtn = document.getElementById('doTranslateBtn');
const translationOutput = document.getElementById('translationOutput');

// 1. Open the panel
translateBtn?.addEventListener('click', () => {
  // Close AST if open (optional, keeps UI clean)
  document.getElementById('astVisualizer').style.display = 'none';
  
  translatorPanel.style.display = 'flex';
  editor.layout(); // Resize editor
  translationOutput.textContent = '// Select a language and click Convert...';
});

// 2. Close the panel
closeTranslateBtn?.addEventListener('click', () => {
  translatorPanel.style.display = 'none';
  editor.layout();
});

// 3. Perform Translation
doTranslateBtn?.addEventListener('click', async () => {
  const code = editor.getValue();
  const target = document.getElementById('targetLang').value;
  
  if (!code.trim()) return;

  translationOutput.textContent = `Translating to ${target}...`;

  // Prompt specifically asks for code only
  const prompt = `Translate the following code into ${target}. 
  - Provide ONLY the code. 
  - Do not wrap in markdown (no \`\`\`). 
  - Do not add explanations.
  
  Code:
  ${code}`;

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: [], 
        code: code,
        question: prompt
      })
    });
    const data = await res.json();
    
    // Clean up result if AI adds ticks
    let cleanCode = data.answer.replace(/```[a-z]*/g, '').replace(/```/g, '').trim();
    translationOutput.textContent = cleanCode;

  } catch (err) {
    translationOutput.textContent = '// Error: Could not translate.';
  }
});
// --- Complexity Report Feature ---

const complexityReportBtn = document.getElementById('complexityReportBtn');
const complexityPanel = document.getElementById('complexityPanel');
const closeComplexityBtn = document.getElementById('closeComplexityBtn');
const resBigO = document.getElementById('resBigO');
const resOmega = document.getElementById('resOmega');
const resTheta = document.getElementById('resTheta');

// 1. Open the Panel
complexityReportBtn?.addEventListener('click', async () => {
  const code = editor.getValue();
  if (!code.trim()) {
    alert("Please write some code first!");
    return;
  }

  // UI Setup: Hide others, show this, set loading state
  document.getElementById('astVisualizer').style.display = 'none';
  document.getElementById('translatorPanel').style.display = 'none';
  complexityPanel.style.display = 'flex';
  editor.layout();

  resBigO.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  resOmega.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  resTheta.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  // 2. The Prompt
  const prompt = `Analyze the time complexity of this code. 
  Return ONLY a raw JSON object (no markdown formatting) with these exact keys: "O", "Omega", "Theta".
  The values should be the mathematical equation only (e.g. "n^2", "log n", "1").
  
  Code:
  ${code}`;

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        history: [], 
        code: code,
        question: prompt
      })
    });
    const data = await res.json();
    
    // 3. Parse the JSON response
    // We try to clean the response in case AI adds text around the JSON
    const cleanJson = data.answer.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanJson);

    // 4. Update UI with equations
    // We prepend the symbols for display
    resBigO.textContent = `O(${result.O || '?'})`;
    resOmega.textContent = `Ω(${result.Omega || '?'})`;
    resTheta.textContent = `Θ(${result.Theta || '?'})`;

  } catch (err) {
    console.error(err);
    resBigO.textContent = "Error";
    resOmega.textContent = "Error";
    resTheta.textContent = "Error";
  }
});

// Close Panel
closeComplexityBtn?.addEventListener('click', () => {
  complexityPanel.style.display = 'none';
  editor.layout();
});