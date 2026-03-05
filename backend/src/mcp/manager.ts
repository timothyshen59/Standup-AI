/**
 * MCP GitHub Server Manager
 *
 * Spawns a dedicated MCP server process per user session/job for isolation.
 * Each process connects to GitHub with the user's token and exposes tools
 * for fetching commits, PRs, issues, and reviews.
 *
 * Architecture:
 *   Backend (Express) → spawns child process → MCP Server (stdio transport)
 *   → MCP Client in backend communicates over stdin/stdout
 *   → Server fetches GitHub data → returns structured context
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn, type ChildProcess } from "child_process";
import path from "path";
import { v4 as uuid } from "uuid";

export interface MCPSession {
  id: string;
  client: Client;
  transport: StdioClientTransport;
  process: ChildProcess;
  userId: string;
  createdAt: Date;
}

export interface GitHubActivity {
  commits: Array<{
    repo: string;
    sha: string;
    message: string;
    timestamp: string;
    additions: number;
    deletions: number;
  }>;
  pullRequests: Array<{
    repo: string;
    number: number;
    title: string;
    state: string;
    action: "opened" | "merged" | "reviewed" | "commented";
    timestamp: string;
  }>;
  issues: Array<{
    repo: string;
    number: number;
    title: string;
    action: "opened" | "closed" | "commented";
    timestamp: string;
  }>;
  reviews: Array<{
    repo: string;
    prNumber: number;
    prTitle: string;
    state: string;
    timestamp: string;
  }>;
  repos: string[];
}

// Active sessions (keyed by session ID)
const activeSessions = new Map<string, MCPSession>();

/**
 * Spawn a new MCP server process for a user.
 * The server runs as a child process using stdio transport.
 */
export async function spawnMCPSession(
  userId: string,
  githubToken: string
): Promise<MCPSession> {
  const sessionId = uuid();

  console.log(`[mcp] Spawning session ${sessionId} for user ${userId}`);

  // Spawn the MCP GitHub server as a child process
  const serverPath = path.resolve(__dirname, "github-server.ts");

  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath],
    env: {
      ...process.env,
      GITHUB_TOKEN: githubToken,
      MCP_SESSION_ID: sessionId,
      MCP_USER_ID: userId,
    },
  });

  const client = new Client(
    { name: "standup-ai-backend", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);

  const session: MCPSession = {
    id: sessionId,
    client,
    transport,
    process: (transport as any)._process, // access underlying child process
    userId,
    createdAt: new Date(),
  };

  activeSessions.set(sessionId, session);

  console.log(`[mcp] Session ${sessionId} connected (pid: ${session.process?.pid})`);

  return session;
}

/**
 * Use an MCP session to fetch GitHub activity for standup generation.
 */
export async function fetchGitHubActivity(
  session: MCPSession,
  options: {
    window?: string;     // "12h" | "24h" | "48h" | "7d"
    repos?: string[];    // specific repos, empty = all
    excludeRepos?: string[];
  } = {}
): Promise<GitHubActivity> {
  const { window = "24h", repos = [], excludeRepos = [] } = options;

  console.log(`[mcp:${session.id}] Fetching GitHub activity (window: ${window})`);

  // Call the MCP tool to get recent activity
  const result = await session.client.callTool({
    name: "get_recent_activity",
    arguments: {
      window,
      repos: repos.length > 0 ? repos : undefined,
      exclude_repos: excludeRepos.length > 0 ? excludeRepos : undefined,
    },
  });

  // Parse the structured response
  const content = result.content as Array<{ type: string; text?: string }>;
  const textContent = content.find((c) => c.type === "text")?.text;

  if (!textContent) {
    throw new Error("MCP server returned no activity data");
  }

  return JSON.parse(textContent) as GitHubActivity;
}

/**
 * Terminate an MCP session and clean up resources.
 */
export async function terminateSession(sessionId: string): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  console.log(`[mcp] Terminating session ${sessionId} (pid: ${session.process?.pid})`);

  try {
    await session.client.close();
  } catch (err) {
    console.warn(`[mcp] Error closing client for session ${sessionId}:`, err);
  }

  // Force kill if still alive after 5s
  if (session.process && !session.process.killed) {
    session.process.kill("SIGTERM");
    setTimeout(() => {
      if (!session.process.killed) {
        session.process.kill("SIGKILL");
      }
    }, 5000);
  }

  activeSessions.delete(sessionId);
  console.log(`[mcp] Session ${sessionId} terminated`);
}

/**
 * Clean up stale sessions (e.g., older than 5 minutes).
 * Run on an interval.
 */
export function cleanupStaleSessions(maxAgeMs = 5 * 60 * 1000): void {
  const now = Date.now();
  for (const [id, session] of activeSessions) {
    if (now - session.createdAt.getTime() > maxAgeMs) {
      console.log(`[mcp] Cleaning up stale session ${id}`);
      terminateSession(id);
    }
  }
}

// Run cleanup every 60 seconds
setInterval(() => cleanupStaleSessions(), 60_000);
