/**
 * API Client
 *
 * Wraps fetch with Auth0 access token injection.
 * All backend calls go through this to ensure authenticated requests.
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

let getAccessToken: (() => Promise<string>) | null = null;

/** Called once from Auth0Provider setup to wire in token fetching */
export function setTokenGetter(fn: () => Promise<string>) {
  getAccessToken = fn;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!getAccessToken) {
    throw new Error("API client not initialized — Auth0 token getter not set");
  }

  const token = await getAccessToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }

  return res.json();
}

// ─── Standup endpoints ────────────────────────────────────────

export interface GenerateStandupRequest {
  prompt?: string;
  apiKey: string;
  model?: string;
  window?: string;
  repos?: string[];
}

export interface StandupResponse {
  id: string;
  content: string;
  repos: string[];
  model: string;
  tokensUsed: number;
  createdAt: string;
}

export async function generateStandup(body: GenerateStandupRequest) {
  return apiFetch<{ standup: StandupResponse }>("/standup/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getStandupHistory(page = 1, limit = 20) {
  return apiFetch<{
    standups: StandupResponse[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>(`/standup/history?page=${page}&limit=${limit}`);
}

export async function deleteStandup(id: string) {
  return apiFetch<{ deleted: boolean }>(`/standup/${id}`, { method: "DELETE" });
}

// ─── User endpoints ───────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  githubUsername: string | null;
  githubConnected: boolean;
  hasApiKey: boolean;
  preferredModel: string;
  settings: {
    activityWindow: string;
    repos: string[];
    excludeRepos: string[];
    standupFormat: string;
  } | null;
}

export async function getMe() {
  return apiFetch<{ user: UserProfile }>("/user/me");
}

export async function updateSettings(body: Record<string, unknown>) {
  return apiFetch<{ settings: unknown }>("/user/settings", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function storeGitHubToken(token: string) {
  return apiFetch<{ connected: boolean }>("/user/github-token", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function storeApiKey(apiKey: string) {
  return apiFetch<{ stored: boolean }>("/user/api-key", {
    method: "POST",
    body: JSON.stringify({ apiKey }),
  });
}
