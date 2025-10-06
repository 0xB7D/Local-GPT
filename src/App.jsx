import { useState, useRef, useEffect, useMemo } from "react";
import {
  Send, Cpu, Settings, Bot, Plus, MessageSquare, Copy, Trash2, Paperclip, X, Mic, MicOff, Phone, PhoneOff
} from "lucide-react";
import "./App.css";
import "./animations.css"; // ← NEW: global animation utilities

// KaTeX for math rendering
import katex from "katex";
import "katex/dist/katex.min.css";

// Syntax highlighting
import hljs from "highlight.js/lib/core";
import "highlight.js/styles/github-dark-dimmed.min.css";

// Register the languages you care about (add more as needed)
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import yaml from "highlight.js/lib/languages/yaml";
import xml from "highlight.js/lib/languages/xml";     // html/xml
import cssLang from "highlight.js/lib/languages/css";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("json", json);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", cssLang);
hljs.registerLanguage("c", c);
hljs.registerLanguage("h", c);          // header files (optional)
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c++", cpp);      // alias
hljs.registerLanguage("hpp", cpp);      // header files (optional)
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("cs", csharp);    // alias
hljs.registerLanguage("c#", csharp);    // alias

import SlideIn from './components/SlideIn.jsx'; // ← NEW
import SpringButton from './components/SpringButton.jsx';// ← NEW
import FloatingOrbs from './components/FloatingOrbs.jsx';// ← NEW
import useStaggeredList from './hooks/useStaggeredList.js';

/** ───────────────────────────────────────────────────────────
 *  EDITABLE MODEL LIST
 *  Add/remove items here. `value` must match your Ollama model name.
 *  Optional `options` are sent to /api/chat (e.g. temperature, num_ctx).
 *  Docs: https://github.com/ollama/ollama/blob/main/docs/api.md#options
 *  ─────────────────────────────────────────────────────────── */
const MODEL_LIST = [
  // { value: "qwen2.5-coder", label: "Qwen2.5 Coder", options: { num_ctx: 4096 } },
  // { value: "mistral:7b", label: "Mistral 7B", options: { num_ctx: 8192 } },
  { value: "llama3:latest", label: "Llama 3", options: { temperature: 0.1, num_ctx: 8192 } },
];

// Check if we're running on a development server (has a port number and it's a dev port)
const isDevelopment = import.meta.env.DEV || 
  (window.location.port && !['80', '443'].includes(window.location.port));

// Use proxy in development, direct connection in production
//const OLLAMA_BASE = isDevelopment ? "/ollama" : "http://192.168.50.194:11434"; // local
const OLLAMA_BASE = isDevelopment ? "/ollama" : "http://192.168.50.88:11434"; // pi5

console.log("Environment info:");
console.log("- DEV mode:", import.meta.env.DEV);
console.log("- Window port:", window.location.port);
console.log("- Hostname:", window.location.hostname);
console.log("- isDevelopment:", isDevelopment);
console.log("- OLLAMA_BASE:", OLLAMA_BASE);
console.log("- Current origin:", window.location.origin);
console.log("- User agent:", navigator.userAgent);
console.log("- Is mobile:", /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
console.log("- Current host:", window.location.host);
console.log("- Protocol:", window.location.protocol);

// ---------- Markdown-lite (safe) for non-code text blocks ----------
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Remove <think>...</think> blocks from model output
function stripThinkBlocks(text) {
  if (!text) return "";
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

// Pretty time: 2310ms -> "2.31s"
function formatMs(ms) {
  if (ms < 1000) return ms + "ms";
  return (ms / 1000).toFixed(2) + "s";
}

// inline: **bold**, *italic*, `code`, links, math
function renderInline(md) {
  let html = escapeHtml(md);

  // Process math expressions after HTML escaping but before other formatting
  // inline math: \(expression\) -> KaTeX inline math
  html = html.replace(/\\?\\\(([^)]+)\\\)/g, (match, expr) => {
    try {
      const rendered = katex.renderToString(expr, {
        displayMode: false,
        throwOnError: false
      });
      return `<span class="math-inline">${rendered}</span>`;
    } catch (e) {
      return `<span class="math-error">\\(${expr}\\)</span>`;
    }
  });

  // display math: \[expression\] -> KaTeX display math  
  html = html.replace(/\\?\\\[([^\]]+)\\\]/g, (match, expr) => {
    try {
      const rendered = katex.renderToString(expr, {
        displayMode: true,
        throwOnError: false
      });
      return `<div class="math-display">${rendered}</div>`;
    } catch (e) {
      return `<div class="math-error">\\[${expr}\\]</div>`;
    }
  });

  // links: https://example.com or http(s)://… or www.…
  html = html.replace(
    /\b((?:https?:\/\/|www\.)[^\s<]+)\b/gi,
    (m, url) => `<a href="${url.startsWith("http") ? url : "http://" + url}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`
  );

  // inline code
  html = html.replace(/`([^`]+)`/g, (_m, g) => `<code class="md-inline-code">${escapeHtml(g)}</code>`);

  // bold **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // italic *text*  (do after bold to avoid conflicts)
  html = html.replace(/(^|[\s(])\*([^*]+)\*(?=[\s).!?]|$)/g, "$1<em>$2</em>");

  return html;
}

// block renderer for lists/paragraphs/headings
function renderMarkdownLite(md) {
  // normalize line endings
  const text = md.replace(/\r\n?/g, "\n").trim();
  if (!text) return "";

  const lines = text.split("\n");

  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // empty line -> paragraph break
    if (!line.trim()) {
      i++;
      continue;
    }

    // headings: #, ##, ### (simple)
    const h = line.match(/^(\#{1,3})\s+(.+)$/);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level} class="md-h${level}">${renderInline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    // ordered list: N. item
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      out.push(
        `<ol class="md-ol">` +
          items.map((it) => `<li>${renderInline(it)}</li>`).join("") +
        `</ol>`
      );
      continue;
    }

    // unordered list: - item  or * item
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      out.push(
        `<ul class="md-ul">` +
          items.map((it) => `<li>${renderInline(it)}</li>`).join("") +
        `</ul>`
      );
      continue;
    }

    // paragraph: collect until blank line
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim()) {
      buf.push(lines[i]);
      i++;
    }
    out.push(`<p class="md-p">${renderInline(buf.join(" "))}</p>`);
  }

  return out.join("\n");
}

/* ── Toasts ─────────────────────────────────────────────── */
function Toasts({ toasts }) {
  return (
    <div className="toast-container" aria-live="polite" aria-atomic="true">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ── Markdown-lite parser for fenced code blocks ────────── */
// Supports: ```lang\n...code...\n``` (multiple blocks per message)
function parseContentToBlocks(text) {
  const blocks = [];
  const fence = /```(\w+)?\n([\s\S]*?)```/g; // lang is optional
  let lastIndex = 0;
  let match;

  while ((match = fence.exec(text)) !== null) {
    // text before the code block
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      blocks.push({ type: "text", text: plain.trim() ? plain : "" });
    }
    const lang = (match[1] || "text").toLowerCase();
    const code = match[2] ?? "";
    blocks.push({ type: "code", lang, code });
    lastIndex = fence.lastIndex;
  }

  // trailing text after last block
  if (lastIndex < text.length) {
    blocks.push({ type: "text", text: text.slice(lastIndex) });
  }
  // filter out empty text blocks caused by trimming
  return blocks.filter((b) => !(b.type === "text" && !b.text.trim()));
}

/* ── Code block with header + copy button ───────────────── */
function CodeBlock({ lang = "text", code = "", explanation = "", onToast, setCodeViewer }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef(null);

  useEffect(() => {
    if (!codeRef.current) return;
    try {
      hljs.highlightElement(codeRef.current);
    } catch {}
  }, [code, lang]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onToast?.("Code copied");
      setTimeout(() => setCopied(false), 900);
    } catch {}
  };

  const onExpand = () => {
    setCodeViewer({ isOpen: true, code, language: lang || "text", explanation });
  };

  // Normalize class for hljs: language-<lang>
  const langClass = lang ? `language-${lang.toLowerCase()}` : "";

  return (
    <div className="code-section">
      <div className="code-header">
        <span className="code-lang">{lang || "text"}</span>
        <div className="code-actions">
          <button className="code-expand" onClick={onExpand} title="Expand code">
            ⛶
          </button>
          <button className="code-copy" onClick={onCopy} title="Copy code">
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
      <pre className="code-body">
        <code ref={codeRef} className={`hljs ${langClass}`}>
          {code}
        </code>
      </pre>
    </div>
  );
}

// Helper to lookup a model definition
const getModelDef = (id) => MODEL_LIST.find((m) => m.value === id) || { value: id, label: id, options: {} };

const makeId = () => "c" + Date.now().toString(36);
const welcomeMsg = {
  role: "assistant",
  content: "Hello! How can I assist you today?",
};
const titleFrom = (text) =>
  text.trim().replace(/\s+/g, " ").split(" ").slice(0, 6).join(" ").replace(/[.!?]+$/, "") || "Untitled";

// Settings Modal Component - moved outside to prevent recreation
const SettingsModal = ({ showSettings, setShowSettings, settings, setSettings }) => {
  if (!showSettings) return null;

  const handleTemperatureChange = (e) => {
    setSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }));
  };

  const handleMaxTokensChange = (e) => {
    setSettings(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }));
  };

  const handleSystemPromptChange = (e) => {
    setSettings(prev => ({ ...prev, systemPrompt: e.target.value }));
  };

  const handleCloseModal = () => {
    setShowSettings(false);
  };

  return (
    <div className="settings-overlay" onClick={handleCloseModal}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button 
            className="settings-close" 
            onClick={handleCloseModal}
            title="Close"
          >
            ✕
          </button>
        </div>
        
        <div className="settings-content">
          <div className="settings-section">
            <label htmlFor="temperature">Temperature</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <input
                id="temperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={settings.temperature}
                onChange={handleTemperatureChange}
                style={{ flex: 1 }}
              />
              <span className="settings-value">{settings.temperature}</span>
            </div>
          </div>

          <div className="settings-section">
            <label htmlFor="maxTokens">Max Tokens</label>
            <input
              id="maxTokens"
              type="number"
              min="256"
              max="32768"
              step="256"
              value={settings.maxTokens}
              onChange={handleMaxTokensChange}
            />
          </div>

          <div className="settings-section">
            <label htmlFor="systemPrompt">System Prompt</label>
            <textarea
              id="systemPrompt"
              placeholder="Enter a system prompt to guide the AI's behavior..."
              value={settings.systemPrompt}
              onChange={handleSystemPromptChange}
              rows={4}
            />
          </div>
        </div>

        <div className="settings-footer">
          <SpringButton onClick={handleCloseModal}>
            Save & Close
          </SpringButton>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  // ----- persisted app state (conversations) -----
  const testOllama = async () => {
    try {
      const url = `${OLLAMA_BASE}/api/tags`;
      const res = await fetch(url, { method: "GET" });
      const text = await res.text().catch(() => "");
      addToast(res.ok ? `OK: ${url}` : `HTTP ${res.status} @ /api/tags`);
      console.log("TEST /api/tags →", res.status, text);
    } catch (e) {
      addToast(`Failed: ${String(e?.message || e)}`);
      console.error("TEST /api/tags error:", e);
    }
  };

  const loadState = () => {
    try {
      const raw = localStorage.getItem("ollama-ui-state");
      if (!raw) {
        const firstId = makeId();
        return {
          conversations: [{ id: firstId, title: "New chat" }],
          activeConv: firstId,
          messagesByConv: { [firstId]: [welcomeMsg] },
          model: MODEL_LIST[0]?.value || "llama3",
        };
      }
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        model: parsed.model || (MODEL_LIST[0]?.value || "llama3"),
      };
    } catch {
      const firstId = makeId();
      return {
        conversations: [{ id: firstId, title: "New chat" }],
        activeConv: firstId,
        messagesByConv: { [firstId]: [welcomeMsg] },
        model: MODEL_LIST[0]?.value || "llama3",
      };
    }
  };

  const [state, setState] = useState(loadState);
  const { conversations, activeConv, messagesByConv, model } = state;

  useEffect(() => {
    localStorage.setItem("ollama-ui-state", JSON.stringify(state));
  }, [state]);

  const messages = useMemo(
    () => messagesByConv[activeConv] || [],
    [messagesByConv, activeConv]
  );

  const stagger = useStaggeredList(messages.length, 60, 40); // ← NEW

  /* ── Settings state ── */
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("ollama-ui-settings");
      return saved ? JSON.parse(saved) : {
        temperature: 0.1,
        maxTokens: 4096,
        systemPrompt: ""
      };
    } catch {
      return {
        temperature: 0.1,
        maxTokens: 4096,
        systemPrompt: ""
      };
    }
  });

  // Debounced save to localStorage
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem("ollama-ui-settings", JSON.stringify(settings));
    }, 300);
    
    return () => clearTimeout(timeoutId);
  }, [settings]);

  /* ── Toast state ── */
  const [toasts, setToasts] = useState([]);
  const addToast = (text, ttl = 1400) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ttl);
  };

  // ----- UI state -----
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [codeViewer, setCodeViewer] = useState({ isOpen: false, code: "", language: "", explanation: "" });
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [isConversationMode, setIsConversationMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSynthesis, setSpeechSynthesis] = useState(null);
  const conversationModeRef = useRef(false);
  const codeViewerRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);
  const messagesEndRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Syntax highlight code viewer when it opens
  useEffect(() => {
    if (codeViewer.isOpen && codeViewerRef.current) {
      try {
        hljs.highlightElement(codeViewerRef.current);
      } catch {}
    }
  }, [codeViewer.isOpen, codeViewer.code, codeViewer.language]);

  // Keep conversation mode ref in sync
  useEffect(() => {
    conversationModeRef.current = isConversationMode;
  }, [isConversationMode]);

  // Initialize speech recognition
  useEffect(() => {
    console.log('Checking speech recognition support...');
    console.log('webkitSpeechRecognition:', 'webkitSpeechRecognition' in window);
    console.log('SpeechRecognition:', 'SpeechRecognition' in window);
    console.log('Location protocol:', window.location.protocol);
    
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onstart = () => {
        console.log('Speech recognition started');
        setIsListening(true);
        addToast("Listening... Speak now");
      };
      
      recognitionInstance.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('Speech recognized:', transcript);
        console.log('Conversation mode ref:', conversationModeRef.current);
        
        setInput(transcript);
        
        if (conversationModeRef.current) {
          // In conversation mode, automatically send the message
          console.log('Auto-sending in conversation mode');
          addToast("Processing voice message...");
          
          // Use a small delay to ensure state updates
          setTimeout(() => {
            handleSend(null, transcript);
          }, 100);
        } else {
          // In normal mode, just add to input
          setIsListening(false);
          addToast("Voice input captured");
        }
      };
      
      recognitionInstance.onend = () => {
        console.log('Speech recognition ended');
        setIsListening(false);
        
        // In conversation mode, don't restart listening here
        // Let the handleSend completion trigger the next listening cycle
      };
      
      recognitionInstance.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        let errorMessage = 'Voice input error';
        switch(event.error) {
          case 'not-allowed':
            errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
            break;
          case 'no-speech':
            errorMessage = 'No speech detected. Please try again.';
            break;
          case 'network':
            errorMessage = 'Network error. Speech recognition requires internet connection.';
            break;
          default:
            errorMessage = `Speech recognition error: ${event.error}`;
        }
        addToast(errorMessage);
      };
      
      recognitionInstance.onend = () => {
        console.log('Speech recognition ended');
        setIsListening(false);
      };
      
      setRecognition(recognitionInstance);
      console.log('Speech recognition initialized successfully');
    } else {
      console.log('Speech recognition not supported');
      addToast("Speech recognition not supported. Try using Chrome, Edge, or Safari with HTTPS.");
    }
  }, []);

  // Initialize text-to-speech
  useEffect(() => {
    if ('speechSynthesis' in window) {
      setSpeechSynthesis(window.speechSynthesis);
      console.log('Text-to-speech initialized');
    } else {
      console.log('Text-to-speech not supported');
    }
  }, []);

  // Text-to-speech functions
  const speakText = (text) => {
    if (!speechSynthesis) {
      console.log('Speech synthesis not available');
      return;
    }

    // Stop any current speech
    speechSynthesis.cancel();

    // Clean text for speaking (remove markdown, code blocks, etc.)
    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' [code block] ') // Replace code blocks
      .replace(/`([^`]+)`/g, '$1') // Remove inline code backticks
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/#{1,6}\s/g, '') // Remove headers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with text
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Configure voice settings
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 0.8;
    
    // Try to use a more natural voice
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.name.includes('Natural') || 
      voice.name.includes('Neural') ||
      voice.name.includes('Premium') ||
      (voice.lang.startsWith('en') && voice.localService)
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      console.log('Started speaking');
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      console.log('Finished speaking');
      
      // In conversation mode, automatically start listening again
      autoStartListening();
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      setIsSpeaking(false);
    };

    speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (speechSynthesis) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Toggle conversation mode
  const toggleConversationMode = () => {
    const newMode = !isConversationMode;
    setIsConversationMode(newMode);
    conversationModeRef.current = newMode;
    
    if (newMode) {
      addToast("Conversation mode enabled - Say something to start!");
      // Stop any current speech when entering conversation mode
      stopSpeaking();
      // Auto-start listening
      setTimeout(() => {
        autoStartListening();
      }, 1000);
    } else {
      addToast("Conversation mode disabled");
      // Stop listening and speaking when exiting conversation mode
      stopListening();
      stopSpeaking();
    }
  };

  // Voice input functions
  const startListening = () => {
    if (!recognition) {
      const browserInfo = getBrowserInfo();
      addToast(`Speech recognition not supported. You're using ${browserInfo}. Try Chrome, Edge, or Safari with HTTPS.`);
      return;
    }
    
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      addToast("Speech recognition requires HTTPS. Please use a secure connection.");
      return;
    }
    
    if (!isListening) {
      try {
        recognition.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        addToast("Failed to start voice input. Please check microphone permissions.");
      }
    }
  };

  const stopListening = () => {
    if (recognition && isListening) {
      recognition.stop();
    }
  };

  // Auto-start listening in conversation mode when appropriate
  const autoStartListening = () => {
    if (isConversationMode && !isListening && !isSpeaking && !isGenerating) {
      setTimeout(() => {
        startListening();
      }, 1000); // Wait 1 second after AI finishes speaking
    }
  };

  // Helper function to detect browser
  const getBrowserInfo = () => {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown browser';
  };

  // ----- conversations sidebar -----
  const addConversation = () => {
    const id = makeId();
    setState((prev) => ({
      ...prev,
      conversations: [{ id, title: "New chat" }, ...prev.conversations],
      activeConv: id,
      messagesByConv: { ...prev.messagesByConv, [id]: [welcomeMsg] },
    }));
    setInput("");
  };

  const setActiveConvSafe = (id) => {
    setState((prev) => ({
      ...prev,
      activeConv: id,
      messagesByConv: prev.messagesByConv[id]
        ? prev.messagesByConv
        : { ...prev.messagesByConv, [id]: [welcomeMsg] },
    }));
    setInput("");
  };

  const renameConversation = (id) => {
    const cur = conversations.find((c) => c.id === id);
    if (!cur) return;
    const next = prompt("Rename conversation:", cur.title || "Untitled");
    if (!next) return;
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === id ? { ...c, title: next } : c
      ),
    }));
  };

  const deleteConversation = (id) => {
    setState((prev) => {
      if (prev.conversations.length === 1) {
        const newId = makeId();
        return {
          conversations: [{ id: newId, title: "New chat" }],
          activeConv: newId,
          messagesByConv: { [newId]: [welcomeMsg] },
          model: prev.model,
        };
      }
      const idx = prev.conversations.findIndex((c) => c.id === id);
      const nextConversations = prev.conversations.filter((c) => c.id !== id);
      const nextMessagesByConv = { ...prev.messagesByConv };
      delete nextMessagesByConv[id];
      let nextActive = prev.activeConv;
      if (id === prev.activeConv) {
        const neighbor = nextConversations[idx] || nextConversations[idx - 1] || nextConversations[0];
        nextActive = neighbor.id;
      }
      return {
        conversations: nextConversations,
        activeConv: nextActive,
        messagesByConv: nextMessagesByConv,
        model: prev.model,
      };
    });
  };

  // ----- copy -----
  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast("Message copied");
    } catch {
      addToast("Copy failed");
    }
  };

  // ----- file handling -----
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    processFiles(files);
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    e.currentTarget.removeAttribute('data-dragover');
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.setAttribute('data-dragover', 'true');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.removeAttribute('data-dragover');
  };

  const processFiles = async (files) => {
    const maxFileSize = 10 * 1024 * 1024; // 10MB limit
    const supportedTypes = [
      'text/plain', 'text/markdown', 'text/csv',
      'application/json', 'application/javascript',
      'text/html', 'text/css', 'text/xml',
      'application/pdf', 'image/jpeg', 'image/png', 'image/gif'
    ];

    for (const file of files) {
      if (file.size > maxFileSize) {
        addToast(`File ${file.name} is too large (max 10MB)`);
        continue;
      }

      if (!supportedTypes.includes(file.type) && !file.name.match(/\.(txt|md|js|ts|py|java|cpp|c|h|json|xml|html|css)$/i)) {
        addToast(`File type ${file.type} not supported`);
        continue;
      }

      try {
        let content = '';
        let fileInfo = {
          id: Date.now() + Math.random(),
          name: file.name,
          size: file.size,
          type: file.type
        };

        if (file.type.startsWith('image/')) {
          // For images, we'll just show the file info (Ollama doesn't support images in chat API)
          content = `[Image: ${file.name}]`;
          fileInfo.isImage = true;
        } else {
          // Read text content
          content = await readFileAsText(file);
          fileInfo.content = content;
        }

        setAttachedFiles(prev => [...prev, fileInfo]);
        addToast(`Added ${file.name}`);
      } catch (error) {
        addToast(`Failed to read ${file.name}: ${error.message}`);
      }
    }
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const removeAttachedFile = (fileId) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // ----- model select -----
  const handleModelChange = (e) => {
    const nextModel = e.target.value;
    setState((prev) => ({ ...prev, model: nextModel }));
  };

  // ----- send to Ollama (streaming chat) -----
  const handleSend = async (e, voiceText = null) => {
    const t0 = Date.now();

    if (e) e.preventDefault();
    const text = voiceText || input.trim();
    if (!text || isGenerating) return;

    // Prepare user message with file content if any
    let userMessage = text;
    if (attachedFiles.length > 0) {
      const fileContents = attachedFiles.map(file => {
        if (file.isImage) {
          return `[Image attached: ${file.name}]`;
        } else {
          return `[File: ${file.name}]\n\`\`\`\n${file.content}\n\`\`\``;
        }
      }).join('\n\n');
      
      userMessage = `${text}\n\n${fileContents}`;
    }

    // Push user message immediately
    setState((prev) => {
      const thread = prev.messagesByConv[activeConv] || [];
      
      // If there's a previous assistant message, clean it up first
      let updatedThread = thread;
      if (thread.length > 0) {
        const lastIdx = thread.length - 1;
        const last = thread[lastIdx];
        if (last.role === "assistant") {
          const cleaned = stripThinkBlocks(last.content || "");
          const updatedLast = {
            ...last,
            content: cleaned,
            meta: { ...(last.meta || {}), thinkMs: Date.now() - t0 },
          };
          updatedThread = thread.slice(0, lastIdx).concat(updatedLast);
        }
      }
      
      // Add the new user message
      const newThread = [...updatedThread, { role: "user", content: text }];
      
      // Update conversation title if this is the first user message
      let updatedConversations = prev.conversations;
      const currentConv = prev.conversations.find(c => c.id === activeConv);
      if (currentConv && (currentConv.title === "New chat" || thread.length <= 1)) {
        const newTitle = titleFrom(text);
        updatedConversations = prev.conversations.map(c => 
          c.id === activeConv ? { ...c, title: newTitle } : c
        );
      }
      
      return {
        ...prev,
        conversations: updatedConversations,
        messagesByConv: { ...prev.messagesByConv, [activeConv]: newThread },
      };
    });
    
    setInput("");
    setAttachedFiles([]); // Clear attached files after sending

    // Create placeholder assistant message to stream into
    setState((prev) => {
      const thread = prev.messagesByConv[activeConv] || [];
      return {
        ...prev,
        messagesByConv: {
          ...prev.messagesByConv,
          [activeConv]: [...thread, { role: "assistant", content: "" }],
        },
      };
    });

    // Build payload using the whole thread for chat API
    const threadForApi = (msgs) =>
      msgs.map((m) => ({ role: m.role, content: m.content }));

    try {
      setIsGenerating(true);
      const controller = new AbortController();
      abortRef.current = controller;

      const modelDef = getModelDef(model);

      // Prepare messages with optional system prompt
      let messagesForApi = threadForApi(
        (messagesByConv[activeConv] || []).concat([{ role: "user", content: userMessage }])
      );

      // Add system prompt if provided
      if (settings.systemPrompt.trim()) {
        messagesForApi = [
          { role: "system", content: settings.systemPrompt.trim() },
          ...messagesForApi
        ];
      }

      const body = {
        model: modelDef.value,
        stream: true,
        options: {
          ...modelDef.options,
          temperature: settings.temperature,
          num_ctx: settings.maxTokens,
        },
        messages: messagesForApi,
      };

      console.log("Making request to:", `${OLLAMA_BASE}/api/chat`);
      console.log("Request body:", JSON.stringify(body, null, 2));

      const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      console.log("Response status:", res.status);
      console.log("Response ok:", res.ok);

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        console.error("Ollama API Error:", {
          status: res.status,
          statusText: res.statusText,
          text,
          url: `${OLLAMA_BASE}/api/chat`
        });
        throw new Error(`Ollama error ${res.status}: ${text || res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Ollama streams newline-delimited JSON
        const parts = buffer.split("\n");
        buffer = parts.pop() || "";

        for (const line of parts) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            if (chunk?.message?.content) {
              const delta = chunk.message.content;
              // append delta to the last assistant message
              setState((prev) => {
                const thread = prev.messagesByConv[activeConv] || [];
                if (!thread.length) return prev;
                const lastIdx = thread.length - 1;
                const last = thread[lastIdx];
                if (last.role !== "assistant") return prev;
                const updatedLast = { ...last, content: (last.content || "") + delta };
                const newThread = thread.slice(0, lastIdx).concat(updatedLast);
                return {
                  ...prev,
                  messagesByConv: { ...prev.messagesByConv, [activeConv]: newThread },
                };
              });
            }
          } catch {
            // ignore partial lines / parse errors in stream
          }
        }
      }
    } catch (err) {
      console.error(err);
      addToast(String(err?.message || err));

      setState((prev) => {
        const thread = prev.messagesByConv[activeConv] || [];
        if (!thread.length) return prev;
        const lastIdx = thread.length - 1;
        const last = thread[lastIdx];
        if (last.role !== "assistant") return prev;

        const base = last.content || "";
        const cleaned = stripThinkBlocks(base) || `⚠️ ${String(err?.message || err)}`;
        const updatedLast = {
          ...last,
          content: cleaned,
          meta: { ...(last.meta || {}), thinkMs: Date.now() - t0 },
        };
        const newThread = thread.slice(0, lastIdx).concat(updatedLast);
        return {
          ...prev,
          messagesByConv: { ...prev.messagesByConv, [activeConv]: newThread },
        };
      });
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
      
      // In conversation mode, speak the AI response
      if (isConversationMode) {
        // Get the latest AI response to speak
        setState((prev) => {
          const thread = prev.messagesByConv[activeConv] || [];
          if (thread.length > 0) {
            const lastMessage = thread[thread.length - 1];
            if (lastMessage.role === "assistant" && lastMessage.content) {
              const cleanedContent = stripThinkBlocks(lastMessage.content);
              if (cleanedContent && cleanedContent.trim()) {
                // Delay speaking slightly to ensure UI is updated
                setTimeout(() => {
                  speakText(cleanedContent);
                }, 200);
              }
            }
          }
          return prev;
        });
      }
    }
  };

  const stopGeneration = () => {
    abortRef.current?.abort();
  };

  return (
  <div className="app-shell dark">
    {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="logo anim-pop shimmer" style={{ borderRadius: 10, padding: 6 }}>
            <Bot size={20} />
          <span>Ollama Local</span>
        </div>

        <div className="model">
          <label>Model</label>
            <select value={model} onChange={handleModelChange} className="anim-pop">
              {MODEL_LIST.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
                ))}
                {!MODEL_LIST.some((m) => m.value === model) && (
                <option value={model}>{model}</option>
              )}
            </select>
          </div>

          <SpringButton
            style={{ marginTop: '8px', width: '100%' }}
            className="convos-new"
            onClick={testOllama}
            title="Test Ollama"
          >
            Test Ollama connection
          </SpringButton>


          {/* Conversations */}
          <div className="convos">
            <div className="convos-head">
              <span>Conversations</span>
              <SpringButton className="convos-new" onClick={addConversation} title="New chat">
                <Plus size={16} />
              </SpringButton>
            </div>
            <div className="convos-list">
              {conversations.map((c) => (
                <SlideIn key={c.id} style={{ ['--stagger']: '60ms' }}>
                <div
                  className={`convo-item anim-pop ${activeConv === c.id ? 'active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveConvSafe(c.id)}
                  onDoubleClick={() => renameConversation(c.id)}
                  title={c.title}
                  >
                    <div className="convo-main">
                      <MessageSquare size={16} />
                      <span className="convo-title">{c.title}</span>
                    </div>
                    <button
                      className="convo-del anim-pop"
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </SlideIn>
                ))}
              </div>
            </div>
          </div>

        <div className="sidebar-bottom">
          <SpringButton title="Settings" onClick={() => setShowSettings(true)}>
            <Settings size={18} />
          </SpringButton>
        </div>
      </aside>

      {/* Main */}
      <div className="main-area">
        <header className="chat-header">
          <Cpu size={18} className="chat-icon" />
          <span>Ollama GPT (Local)</span>
          
          {recognition && speechSynthesis && (
            <button 
              className={`conversation-mode-toggle ${isConversationMode ? 'active' : ''}`}
              onClick={toggleConversationMode}
              title={isConversationMode ? "Exit conversation mode" : "Enter conversation mode"}
            >
              {isConversationMode ? <PhoneOff size={18} /> : <Phone size={18} />}
              <span>{isConversationMode ? "End Call" : "Voice Call"}</span>
            </button>
          )}
        </header>

        {/* Main */}
        <main className="chat-main">
          <div className="chat-messages">
            {messages.map((msg, i) => {
              // sanitize content (remove <think>…</think>)
              const cleaned = stripThinkBlocks(msg.content);
              return (
                <div key={i} className={`message ${msg.role}`}>
                  {msg.role === "assistant" && (
                    <div className="assistant-icon">
                      <Cpu size={14} />
                    </div>
                  )}
                  <div className="bubble-wrap">
                    <div className="bubble anim-pop">
                      {msg.role === "assistant" && !cleaned ? (
                        <div className="typing-dots" aria-label="Assistant is typing">
                          <span className="dot" />
                          <span className="dot" />
                          <span className="dot" />
                        </div>
                      ) : msg.role === "assistant" ? (
                        (() => {
                          const blocks = parseContentToBlocks(cleaned);
                          const usedAsExplanation = new Set(); // Track which text blocks are used as explanations
                          
                          // First pass: identify which text blocks are explanations for code blocks
                          blocks.forEach((block, idx) => {
                            if (block.type === "code") {
                              for (let i = idx + 1; i < blocks.length; i++) {
                                if (blocks[i].type === "code") break; // Stop at next code block
                                if (blocks[i].type === "text" && blocks[i].text.trim()) {
                                  usedAsExplanation.add(i);
                                }
                              }
                            }
                          });
                          
                          return blocks.map((b, idx) => {
                            if (b.type === "code") {
                              // Find all explanation text after this code block until next code block
                              let explanation = "";
                              for (let i = idx + 1; i < blocks.length; i++) {
                                if (blocks[i].type === "code") break; // Stop at next code block
                                if (blocks[i].type === "text" && blocks[i].text.trim()) {
                                  explanation += (explanation ? "\n\n" : "") + blocks[i].text.trim();
                                }
                              }
                              return (
                                <CodeBlock 
                                  key={idx} 
                                  lang={b.lang} 
                                  code={b.code} 
                                  explanation={explanation}
                                  onToast={addToast} 
                                  setCodeViewer={setCodeViewer} 
                                />
                              );
                            } else if (!usedAsExplanation.has(idx)) {
                              // Only render text blocks that aren't used as explanations
                              return (
                                <div key={idx} className="md" dangerouslySetInnerHTML={{ __html: renderMarkdownLite(b.text) }} />
                              );
                            }
                            return null; // Skip text blocks used as explanations
                          }).filter(Boolean); // Remove null entries
                        })()
                      ) : (
                        msg.content
                      )}
                    </div>
                    {!(msg.role === "assistant" && !cleaned) && (
                      <button className="msg-copy anim-pop" title="Copy" onClick={() => handleCopy(stripThinkBlocks(msg.content))}>
                        <Copy size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* Chat Input - Hidden in conversation mode */}
        {!isConversationMode && (
          <div className="chat-input">
            {/* Attached Files Display */}
            {attachedFiles.length > 0 && (
              <div className="attached-files">
                {attachedFiles.map(file => (
                  <div key={file.id} className="attached-file">
                    <div className="file-info">
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">({(file.size / 1024).toFixed(1)}KB)</span>
                    </div>
                    <button
                    type="button"
                    className="remove-file"
                    onClick={() => removeAttachedFile(file.id)}
                    title="Remove file"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <form 
            onSubmit={handleSend} 
            className="chat-input-inner"
            onDrop={handleFileDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept=".txt,.md,.js,.ts,.py,.java,.cpp,.c,.h,.json,.xml,.html,.css,.pdf,.jpg,.jpeg,.png,.gif"
              style={{ display: 'none' }}
            />
            
            <textarea
              placeholder={isGenerating ? "Generating…" : "Type your message..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isGenerating && input.trim()) {
                    const form = e.target.closest('form');
                    form?.requestSubmit();
                  }
                }
              }}
              disabled={isGenerating}
              className="anim-pop"
              rows={1}
              style={{ 
                resize: 'none',
                minHeight: '44px',
                maxHeight: '200px',
                overflowY: input.split('\n').length > 3 ? 'scroll' : 'hidden'
              }}
            />
            
            <SpringButton
              type="button"
              className="attach-button"
              onClick={triggerFileSelect}
              title="Attach files"
              disabled={isGenerating}
            >
              <Paperclip size={20} />
            </SpringButton>
            
            {recognition && (
              <SpringButton
                type="button"
                className={`voice-button ${isListening ? 'listening' : ''} ${isConversationMode ? 'conversation-mode' : ''}`}
                onClick={isListening ? stopListening : startListening}
                title={
                  isConversationMode 
                    ? (isListening ? "Stop listening" : "Push to talk") 
                    : (isListening ? "Stop recording" : "Voice input")
                }
                disabled={isGenerating || isSpeaking}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                {isConversationMode && (
                  <span className="conversation-status">
                    {isSpeaking ? "AI Speaking..." : isListening ? "Listening..." : "Push to Talk"}
                  </span>
                )}
              </SpringButton>
            )}
            
            <SpringButton
              type={isGenerating ? 'button' : 'submit'}
              title={isGenerating ? "Stop" : "Send"}
              onClick={isGenerating ? stopGeneration : undefined}
            >
              {isGenerating ? "■" : <Send size={18} />}
            </SpringButton>
          </form>
        </div>
        )}

        {/* Conversation Mode Voice Controls */}
        {isConversationMode && (
          <div className="conversation-controls">
            <div className="conversation-status-display">
              <div className="status-indicator">
                {isSpeaking ? (
                  <>
                    <Bot size={24} className="speaking-icon" />
                    <span>AI is speaking...</span>
                  </>
                ) : isListening ? (
                  <>
                    <Mic size={24} className="listening-icon" />
                    <span>Listening for your voice...</span>
                  </>
                ) : isGenerating ? (
                  <>
                    <Cpu size={24} className="thinking-icon" />
                    <span>AI is thinking...</span>
                  </>
                ) : (
                  <>
                    <MicOff size={24} className="ready-icon" />
                    <span>Say something to continue...</span>
                  </>
                )}
              </div>
              
              {recognition && (
                <button 
                  className={`conversation-mic-button ${isListening ? 'listening' : ''}`}
                  onClick={isListening ? stopListening : startListening}
                  disabled={isGenerating || isSpeaking}
                  title={isListening ? "Click to stop listening" : "Click to start listening"}
                >
                  {isListening ? <MicOff size={32} /> : <Mic size={32} />}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal 
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        settings={settings}
        setSettings={setSettings}
      />

      {/* Code Viewer Panel */}
      {codeViewer.isOpen && (
        <div className="code-viewer-overlay">
          <div className="code-viewer-panel">
            <div className="code-viewer-header">
              <span className="code-viewer-title">{codeViewer.language} Code</span>
              <button 
                className="code-viewer-close" 
                onClick={() => setCodeViewer({ isOpen: false, code: "", language: "", explanation: "" })}
              >
                ×
              </button>
            </div>
            <div className="code-viewer-content">
              {codeViewer.explanation && (
                <div className="code-viewer-explanation">
                  <div className="explanation-header">Explanation:</div>
                  <div className="explanation-content" dangerouslySetInnerHTML={{ __html: renderMarkdownLite(codeViewer.explanation) }} />
                </div>
              )}
              <pre className="code-viewer-body">
                <code ref={codeViewerRef} className={`hljs language-${codeViewer.language.toLowerCase()}`}>
                  {codeViewer.code}
                </code>
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Mount toasts once */}
      <Toasts toasts={toasts} />
    </div>
  );
}
