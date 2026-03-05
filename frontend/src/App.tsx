import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  generateStandup as apiGenerateStandup,
  getStandupHistory,
  getMe,
  type StandupResponse,
  type UserProfile,
} from "./lib/api";

// ─── Icons (inline SVG) ──────────────────────────────────────

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function ZapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function RepoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

// ─── Markdown renderer ────────────────────────────────────────

function renderMarkdown(text: string) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements: JSX.Element[] = [];
  let key = 0;

  for (const line of lines) {
    if (line.startsWith("**") && line.endsWith("**")) {
      elements.push(
        <h4 key={key++} className="text-accent font-mono text-xs font-semibold tracking-wider uppercase mt-4 mb-1.5 opacity-90">
          {line.replace(/\*\*/g, "")}
        </h4>
      );
    } else if (line.startsWith("- ")) {
      const content = line.slice(2);
      const parts = content.split(/(`[^`]+`)/g).map((part, i) =>
        part.startsWith("`") && part.endsWith("`") ? (
          <code key={i} className="bg-accent/10 text-accent px-1.5 rounded text-[0.8em] font-mono">
            {part.slice(1, -1)}
          </code>
        ) : (
          part
        )
      );
      elements.push(
        <div key={key++} className="flex gap-2 py-0.5 text-sm text-text-primary leading-relaxed">
          <span className="text-text-dim flex-shrink-0 mt-0.5">›</span>
          <span>{parts}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={key++} className="h-1" />);
    } else {
      elements.push(
        <p key={key++} className="text-sm text-text-primary leading-relaxed my-0.5">
          {line}
        </p>
      );
    }
  }
  return elements;
}

// ─── Process Log Component ────────────────────────────────────

interface LogEntry {
  msg: string;
  type: "info" | "success" | "mcp" | "llm" | "http" | "error";
}

function ProcessLog({ logs }: { logs: LogEntry[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const typeColors: Record<string, string> = {
    info: "text-text-muted bg-text-muted/10",
    success: "text-accent bg-accent/10",
    mcp: "text-purple bg-purple/10",
    llm: "text-yellow-400 bg-yellow-400/10",
    http: "text-blue-400 bg-blue-400/10",
    error: "text-danger bg-danger/10",
  };

  const typeLabels: Record<string, string> = {
    info: "SYS",
    success: " ✓ ",
    mcp: "MCP",
    llm: "LLM",
    http: "HTTP",
    error: "ERR",
  };

  if (logs.length === 0) return null;

  return (
    <div className="bg-[#08080d] border border-border rounded-xl p-3 max-h-56 overflow-y-auto font-mono text-xs leading-7">
      {logs.map((log, i) => (
        <div key={i} className={`flex gap-2 ${i < logs.length - 3 ? "opacity-50" : ""} transition-opacity`}>
          <span className={`font-semibold flex-shrink-0 px-1.5 rounded ${typeColors[log.type]}`}>
            {typeLabels[log.type]}
          </span>
          <span className={log.type === "error" ? "text-danger" : "text-text-muted"}>
            {log.msg}
          </span>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

// ─── Standup Card Component ───────────────────────────────────

function StandupCard({ standup, index }: { standup: StandupResponse; index: number }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(index === 0);

  const date = new Date(standup.createdAt);
  const dateStr = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(standup.content.replace(/\*\*/g, "").replace(/`/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden transition-all">
      <div onClick={() => setExpanded(!expanded)} className="flex items-center justify-between px-5 py-3.5 cursor-pointer select-none">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${index === 0 ? "bg-accent shadow-[0_0_8px_theme(colors.accent)]" : "bg-text-dim"}`} />
          <div>
            <div className="text-sm font-semibold text-text-primary">{dateStr}</div>
            <div className="text-[0.7rem] text-text-dim mt-0.5">{timeStr}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {standup.repos.map((r) => (
            <span key={r} className="inline-flex items-center gap-1 text-[0.7rem] text-text-muted bg-bg px-2 py-0.5 rounded font-mono">
              <RepoIcon />
              {r.split("/")[1] || r}
            </span>
          ))}
          <button onClick={handleCopy} className="text-text-dim hover:text-text-muted p-1 rounded">
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
          <div className={`transition-transform text-text-dim ${expanded ? "rotate-180" : ""}`}>
            <ChevronDownIcon />
          </div>
        </div>
      </div>
      {expanded && (
        <div className="px-5 pb-4 border-t border-border pt-3.5">
          {renderMarkdown(standup.content)}
          <div className="mt-3">
            <span className="text-[0.65rem] text-text-dim font-mono bg-bg px-1.5 py-0.5 rounded">
              {standup.model}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────

function SettingsModal({
  apiKey,
  setApiKey,
  model,
  setModel,
  window: activityWindow,
  setWindow,
  githubUsername,
  onClose,
}: {
  apiKey: string;
  setApiKey: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  window: string;
  setWindow: (v: string) => void;
  githubUsername: string | null;
  onClose: () => void;
}) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[480px] bg-surface border border-border rounded-2xl p-8 shadow-2xl">
        <h3 className="text-text-primary text-lg font-bold mb-6 font-display">Settings</h3>

        {/* GitHub connection */}
        <div className="mb-6">
          <label className="text-xs text-text-muted font-semibold uppercase tracking-wider block mb-2">GitHub Connection</label>
          <div className="flex items-center gap-2.5 p-2.5 px-3.5 bg-bg rounded-lg border border-border">
            <GitHubIcon />
            <span className="text-text-primary text-sm flex-1">@{githubUsername || "not connected"}</span>
            {githubUsername && <span className="text-xs text-accent bg-accent/10 px-2 py-0.5 rounded">Connected</span>}
          </div>
        </div>

        {/* API Key */}
        <div className="mb-6">
          <label className="text-xs text-text-muted font-semibold uppercase tracking-wider block mb-2">LLM API Key</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full p-2.5 pr-10 rounded-lg border border-border bg-bg text-text-primary text-sm font-mono outline-none focus:border-border-active"
            />
            <button onClick={() => setShowKey(!showKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-muted p-1">
              {showKey ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {/* Model */}
        <div className="mb-6">
          <label className="text-xs text-text-muted font-semibold uppercase tracking-wider block mb-2">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full p-2.5 rounded-lg border border-border bg-bg text-text-primary text-sm font-mono outline-none appearance-none cursor-pointer focus:border-border-active"
          >
            <option value="claude-sonnet-4-20250514">claude-sonnet-4-20250514</option>
            <option value="claude-opus-4-6">claude-opus-4-6</option>
            <option value="claude-haiku-4-5-20251001">claude-haiku-4-5-20251001</option>
            <option value="gpt-4o">gpt-4o</option>
          </select>
        </div>

        {/* Activity Window */}
        <div className="mb-8">
          <label className="text-xs text-text-muted font-semibold uppercase tracking-wider block mb-2">Activity Window</label>
          <div className="flex gap-2">
            {["12h", "24h", "48h", "7d"].map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`flex-1 py-2 px-3 rounded-md border text-sm font-semibold font-mono transition-all ${
                  activityWindow === w
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-text-muted hover:border-border-active"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-accent text-bg text-sm font-semibold hover:bg-accent/90 transition-colors">
          Save Settings
        </button>
      </div>
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────

function LoginScreen() {
  const { loginWithRedirect } = useAuth0();

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(#6ee7b7 1px, transparent 1px), linear-gradient(90deg, #6ee7b7 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />
      <div className="relative w-[420px] p-12 bg-surface border border-border rounded-2xl shadow-[0_0_80px_rgba(110,231,183,0.08),0_24px_48px_rgba(0,0,0,0.4)]">
        <div className="text-center mb-9">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center">
              <ZapIcon />
            </div>
            <span className="text-2xl font-bold text-text-primary tracking-tight">
              standup<span className="text-accent">.ai</span>
            </span>
          </div>
          <p className="text-text-muted text-sm">Generate standups from your GitHub activity</p>
        </div>

        <button
          onClick={() => loginWithRedirect({ authorizationParams: { connection: "github" } })}
          className="w-full py-3 px-5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-text-primary text-sm font-semibold flex items-center justify-center gap-2.5 transition-colors"
        >
          <GitHubIcon /> Continue with GitHub
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-text-dim uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="flex flex-col gap-2.5">
          <input
            type="email"
            placeholder="Email address"
            className="w-full p-3 rounded-lg border border-border bg-bg text-text-primary text-sm outline-none focus:border-border-active"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 rounded-lg border border-border bg-bg text-text-primary text-sm outline-none focus:border-border-active"
          />
          <button
            onClick={() => loginWithRedirect()}
            className="w-full py-3 rounded-lg bg-accent-dim hover:bg-accent text-accent hover:text-bg text-sm font-semibold transition-colors"
          >
            Sign in
          </button>
        </div>

        <p className="text-center mt-5 text-xs text-text-dim">Secured by Auth0 · GitHub social connection</p>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────

export default function App() {
  const { isAuthenticated, isLoading, user, logout } = useAuth0();

  const [view, setView] = useState<"generate" | "history">("generate");
  const [prompt, setPrompt] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-20250514");
  const [activityWindow, setActivityWindow] = useState("24h");

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [resultText, setResultText] = useState("");
  const [error, setError] = useState<string | null>(null);

  // History
  const [standups, setStandups] = useState<StandupResponse[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load user profile and history on auth
  useEffect(() => {
    if (!isAuthenticated) return;
    getMe().then((res) => setProfile(res.user)).catch(console.error);
    getStandupHistory().then((res) => setStandups(res.standups)).catch(console.error);
  }, [isAuthenticated]);

  const addLog = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { msg, type }]);
  }, []);

  const handleGenerate = async () => {
    if (generating) return;
    if (!apiKey) {
      setShowSettings(true);
      return;
    }

    setGenerating(true);
    setLogs([]);
    setResultText("");
    setError(null);

    addLog("POST /api/standup/generate", "http");

    try {
      const res = await apiGenerateStandup({
        prompt: prompt || undefined,
        apiKey,
        model,
        window: activityWindow,
      });

      addLog("✓ Standup generated successfully", "success");
      setResultText(res.standup.content);
      setStandups((prev) => [res.standup, ...prev]);
    } catch (err: any) {
      addLog(`Error: ${err.message}`, "error");
      setError(err.message);
    } finally {
      setGenerating(false);
      setPrompt("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <SpinnerIcon />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const initials = (user?.name || user?.email || "U")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      {showSettings && (
        <SettingsModal
          apiKey={apiKey}
          setApiKey={setApiKey}
          model={model}
          setModel={setModel}
          window={activityWindow}
          setWindow={setActivityWindow}
          githubUsername={profile?.githubUsername || user?.nickname || null}
          onClose={() => setShowSettings(false)}
        />
      )}

      <div className="min-h-screen bg-bg font-body text-text-primary">
        {/* Header */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-border bg-bg/90 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center text-xs">
              <ZapIcon />
            </div>
            <span className="text-base font-bold tracking-tight">
              standup<span className="text-accent">.ai</span>
            </span>
          </div>

          <div className="flex gap-0.5 bg-surface rounded-lg p-0.5">
            {[
              { id: "generate" as const, label: "Generate", icon: <ZapIcon /> },
              { id: "history" as const, label: "History", icon: <HistoryIcon /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setView(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  view === tab.id ? "bg-bg text-text-primary" : "text-text-muted hover:text-text-primary"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(true)}
              className="border border-border text-text-muted hover:text-text-primary px-2.5 py-1.5 rounded-md text-xs flex items-center gap-1.5 transition-colors"
            >
              <SettingsIcon /> Settings
            </button>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple to-purple/30 flex items-center justify-center text-xs font-bold text-white">
              {initials}
            </div>
            <button
              onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
              className="text-text-dim hover:text-text-muted p-1 transition-colors"
            >
              <LogoutIcon />
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="max-w-3xl mx-auto px-5 pt-8 pb-32">
          {view === "generate" ? (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              {/* Hero when idle */}
              {!generating && !resultText && !error && (
                <div className="text-center py-16 pb-10">
                  <h1 className="text-3xl font-bold tracking-tight mb-2.5 font-display">What did you ship?</h1>
                  <p className="text-text-muted text-base max-w-md mx-auto">
                    Generate your standup from GitHub activity via MCP-powered context
                  </p>
                </div>
              )}

              {/* Process logs */}
              {logs.length > 0 && (
                <div className="mb-5" style={{ animation: "fadeIn 0.3s ease" }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <TerminalIcon />
                    <span className="text-xs text-text-muted font-mono font-semibold">Pipeline</span>
                    {generating && <span className="text-[0.7rem] text-accent font-mono" style={{ animation: "pulse 1.5s infinite" }}>running</span>}
                  </div>
                  <ProcessLog logs={logs} />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-danger/10 border border-danger/30 rounded-xl p-4 mb-5 text-sm text-danger">
                  {error}
                </div>
              )}

              {/* Result */}
              {resultText && (
                <div className="bg-surface border border-border rounded-xl p-5 mb-5" style={{ animation: "fadeIn 0.3s ease" }}>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-accent shadow-[0_0_8px_theme(colors.accent)]" />
                      <span className="text-sm font-semibold text-text-primary">Today's Standup</span>
                    </div>
                    <span className="text-[0.7rem] text-text-dim font-mono">
                      {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                  </div>
                  {renderMarkdown(resultText)}
                </div>
              )}

              {/* Input bar */}
              <div className="fixed bottom-0 left-0 right-0 px-5 pb-6 pt-4 bg-gradient-to-t from-bg via-bg to-transparent">
                <div className="max-w-3xl mx-auto bg-surface border border-border rounded-2xl p-1 pl-4 flex items-end gap-2 shadow-[0_-8px_32px_rgba(0,0,0,0.3)]">
                  <textarea
                    ref={inputRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe what you want in your standup, or just hit send for the default..."
                    rows={1}
                    disabled={generating}
                    className="flex-1 bg-transparent text-text-primary text-sm outline-none py-2.5 leading-relaxed min-h-[20px] resize-none placeholder:text-text-dim disabled:opacity-50"
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = "auto";
                      target.style.height = Math.min(target.scrollHeight, 120) + "px";
                    }}
                  />
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      generating
                        ? "bg-border text-text-dim cursor-not-allowed"
                        : "bg-accent text-bg hover:bg-accent/90 cursor-pointer"
                    }`}
                  >
                    {generating ? <SpinnerIcon /> : <SendIcon />}
                  </button>
                </div>
                <div className="text-center mt-2">
                  <span className="text-[0.65rem] text-text-dim font-mono">
                    MCP → GitHub Activity → LLM → Standup · Model: {model}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* History view */
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold tracking-tight font-display">Standup History</h2>
                  <p className="text-text-muted text-sm mt-1">{standups.length} standups generated</p>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                {standups.map((s, i) => (
                  <StandupCard key={s.id} standup={s} index={i} />
                ))}
              </div>
              {standups.length === 0 && (
                <div className="text-center py-20 text-text-dim">
                  <HistoryIcon />
                  <p className="mt-3 text-sm">No standups yet. Generate your first one!</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
