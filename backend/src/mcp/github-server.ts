#!/usr/bin/env node
/**
 * MCP GitHub Server (Child Process)
 *
 * This file runs as a separate process, spawned by the MCP manager.
 * It uses stdio transport to communicate with the parent process.
 * Each instance gets its own GITHUB_TOKEN via environment variables.
 *
 * Tools exposed:
 *   - get_recent_activity: Fetch commits, PRs, issues, reviews in a time window
 *   - get_repo_commits: Fetch commits for a specific repo
 *   - get_user_prs: Fetch PRs authored/reviewed by the user
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_API = "https://api.github.com";
const SESSION_ID = process.env.MCP_SESSION_ID || "unknown";

if (!GITHUB_TOKEN) {
  console.error("[mcp-github] GITHUB_TOKEN not set");
  process.exit(1);
}

// ─── GitHub API Helpers ───────────────────────────────────────

async function githubFetch(path: string, params?: Record<string, string>) {
  const url = new URL(`${GITHUB_API}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

function getWindowDate(window: string): Date {
  const now = new Date();
  const hours: Record<string, number> = {
    "12h": 12,
    "24h": 24,
    "48h": 48,
    "7d": 168,
  };
  const h = hours[window] || 24;
  return new Date(now.getTime() - h * 60 * 60 * 1000);
}

async function getAuthenticatedUser(): Promise<string> {
  const user = await githubFetch("/user");
  return user.login;
}

async function getUserRepos(username: string): Promise<string[]> {
  const repos = await githubFetch("/user/repos", {
    sort: "pushed",
    per_page: "30",
    affiliation: "owner,collaborator,organization_member",
  });
  return repos.map((r: any) => r.full_name);
}

async function getRepoCommits(
  repo: string,
  since: string,
  author: string
): Promise<any[]> {
  try {
    return await githubFetch(`/repos/${repo}/commits`, {
      since,
      author,
      per_page: "50",
    });
  } catch {
    return []; // repo may not have commits or access denied
  }
}

async function getUserPRs(
  username: string,
  since: Date
): Promise<any[]> {
  const sinceStr = since.toISOString().split("T")[0];
  // Search for PRs authored by user, updated after since date
  const result = await githubFetch("/search/issues", {
    q: `type:pr author:${username} updated:>=${sinceStr}`,
    sort: "updated",
    per_page: "30",
  });
  return result.items || [];
}

async function getUserReviews(
  username: string,
  since: Date
): Promise<any[]> {
  const sinceStr = since.toISOString().split("T")[0];
  const result = await githubFetch("/search/issues", {
    q: `type:pr reviewed-by:${username} updated:>=${sinceStr}`,
    sort: "updated",
    per_page: "20",
  });
  return result.items || [];
}

// ─── MCP Server Setup ────────────────────────────────────────

const server = new Server(
  {
    name: "standup-ai-github",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_recent_activity",
      description:
        "Fetch recent GitHub activity (commits, PRs, issues, reviews) for the authenticated user within a time window.",
      inputSchema: {
        type: "object" as const,
        properties: {
          window: {
            type: "string",
            description: 'Time window: "12h", "24h", "48h", or "7d"',
            default: "24h",
          },
          repos: {
            type: "array",
            items: { type: "string" },
            description: "Specific repos to check (full name, e.g. owner/repo). Empty = all recent repos.",
          },
          exclude_repos: {
            type: "array",
            items: { type: "string" },
            description: "Repos to exclude from results.",
          },
        },
      },
    },
    {
      name: "get_repo_commits",
      description: "Fetch commits for a specific repository.",
      inputSchema: {
        type: "object" as const,
        properties: {
          repo: {
            type: "string",
            description: "Full repo name (e.g. owner/repo)",
          },
          window: {
            type: "string",
            description: 'Time window: "12h", "24h", "48h", or "7d"',
            default: "24h",
          },
        },
        required: ["repo"],
      },
    },
  ],
}));

// Register tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "get_recent_activity") {
    const window = (args?.window as string) || "24h";
    const filterRepos = (args?.repos as string[]) || [];
    const excludeRepos = new Set((args?.exclude_repos as string[]) || []);
    const since = getWindowDate(window);

    const username = await getAuthenticatedUser();
    let repos = filterRepos.length > 0
      ? filterRepos
      : await getUserRepos(username);

    // Apply exclusions
    repos = repos.filter((r) => !excludeRepos.has(r));

    // Fetch commits across repos (parallel)
    const commitResults = await Promise.allSettled(
      repos.map((repo) =>
        getRepoCommits(repo, since.toISOString(), username).then((commits) =>
          commits.map((c: any) => ({
            repo,
            sha: c.sha?.slice(0, 7),
            message: c.commit?.message?.split("\n")[0] || "",
            timestamp: c.commit?.author?.date || "",
            additions: c.stats?.additions || 0,
            deletions: c.stats?.deletions || 0,
          }))
        )
      )
    );

    const commits = commitResults
      .filter((r): r is PromiseFulfilledResult<any[]> => r.status === "fulfilled")
      .flatMap((r) => r.value)
      .filter((c) => new Date(c.timestamp) >= since);

    // Fetch PRs and reviews
    const [prs, reviews] = await Promise.all([
      getUserPRs(username, since),
      getUserReviews(username, since),
    ]);

    const pullRequests = prs.map((pr: any) => ({
      repo: pr.repository_url?.split("/repos/")[1] || "",
      number: pr.number,
      title: pr.title,
      state: pr.state,
      action: pr.pull_request?.merged_at ? "merged" : "opened",
      timestamp: pr.updated_at,
    }));

    const reviewList = reviews.map((r: any) => ({
      repo: r.repository_url?.split("/repos/")[1] || "",
      prNumber: r.number,
      prTitle: r.title,
      state: "reviewed",
      timestamp: r.updated_at,
    }));

    // Deduce active repos
    const activeRepos = [
      ...new Set([
        ...commits.map((c) => c.repo),
        ...pullRequests.map((p) => p.repo),
        ...reviewList.map((r) => r.repo),
      ]),
    ];

    const activity = {
      commits,
      pullRequests,
      issues: [], // Could add issue tracking too
      reviews: reviewList,
      repos: activeRepos,
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(activity, null, 2),
        },
      ],
    };
  }

  if (name === "get_repo_commits") {
    const repo = args?.repo as string;
    const window = (args?.window as string) || "24h";
    const since = getWindowDate(window);
    const username = await getAuthenticatedUser();
    const commits = await getRepoCommits(repo, since.toISOString(), username);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            commits.map((c: any) => ({
              sha: c.sha?.slice(0, 7),
              message: c.commit?.message || "",
              date: c.commit?.author?.date || "",
            })),
            null,
            2
          ),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// ─── Start Server ─────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mcp-github:${SESSION_ID}] Server running on stdio`);
}

main().catch((err) => {
  console.error("[mcp-github] Fatal error:", err);
  process.exit(1);
});
