/**
 * LLM Service
 *
 * Takes structured GitHub activity data and generates a standup report
 * using the user's preferred LLM model and API key.
 *
 * Supports: Anthropic (Claude), OpenAI (GPT)
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { GitHubActivity } from "../mcp/manager.js";

export interface LLMConfig {
  apiKey: string;
  model: string;
}

export interface StandupResult {
  content: string;
  tokensUsed: number;
  model: string;
}

const SYSTEM_PROMPT = `You are a software engineer writing your own daily standup for the team. Use first-person ("I") language.

Analyze the provided GitHub activity step-by-step:
1. Identify recent completed work: merged PRs, commits, reviews in the given time period.
2. Check for blockers: stalled items, errors. 

Output SIMILAR in this markdown format (feel free to include extra details if needed or bullet points to fully summarize work):

**Recent:**
- Bullet 1: Commit abcdef: Shipped Feature X with Y using Z 
- Bullet 2...

**Blockers:**
- Specific or "None"

Rules:
- 2-4 bullets/section max.
-If there is extra space, fill it up with more detail to max out the 1024-token. We would rather have a more detailed, complete message, than a short one with insufficent detail
- Reference PRs/Commits/Branches/Repo Activity + 1-2 line desc from data.
- If low activity: "Light period—[honest summary]".
-If there are no blockers, don't include any 
- Technical, team-readable, present tense.
- Total <200 words.`;


function buildUserPrompt(activity: GitHubActivity, userPrompt?: string): string {
  const parts: string[] = [];

  parts.push("Here is my recent GitHub activity:\n");

  if (activity.commits.length > 0) {
    parts.push("## Commits");
    for (const c of activity.commits) {
      parts.push(`- [${c.repo}] ${c.sha}: ${c.message} (${c.timestamp})`);
    }
    parts.push("");
  }

  if (activity.pullRequests.length > 0) {
    parts.push("## Pull Requests");
    for (const pr of activity.pullRequests) {
      parts.push(`- [${pr.repo}] PR #${pr.number}: ${pr.title} (${pr.action}, ${pr.timestamp})`);
    }
    parts.push("");
  }

  if (activity.reviews.length > 0) {
    parts.push("## Reviews");
    for (const r of activity.reviews) {
      parts.push(`- [${r.repo}] PR #${r.prNumber}: ${r.prTitle} (${r.state}, ${r.timestamp})`);
    }
    parts.push("");
  }

  if (activity.commits.length === 0 && activity.pullRequests.length === 0 && activity.reviews.length === 0) {
    parts.push("No significant activity found in this time window.");
  }

  parts.push(`\nActive repos: ${activity.repos.join(", ") || "none"}`);

  if (userPrompt) {
    parts.push(`\n\nAdditional context from user: ${userPrompt}`);
  }

  parts.push("\n\nPlease generate my standup update based on this activity.");

  return parts.join("\n");
}

/**
 * Generate a standup using Anthropic's Claude API.
 */
async function generateWithAnthropic(
  config: LLMConfig,
  activity: GitHubActivity,
  userPrompt?: string
): Promise<StandupResult> {
  const client = new Anthropic({ apiKey: config.apiKey });

  const response = await client.messages.create({
    model: config.model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserPrompt(activity, userPrompt),
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const content = textBlock?.text || "Failed to generate standup.";

  return {
    content,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    model: config.model,
  };
}

/**
 * Generate a standup using OpenAI's GPT API.
 */
async function generateWithOpenAI(
  config: LLMConfig,
  activity: GitHubActivity,
  userPrompt?: string
): Promise<StandupResult> {
  const client = new OpenAI({ apiKey: config.apiKey });

  const response = await client.chat.completions.create({
    model: config.model,
    max_tokens: 1024,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(activity, userPrompt) },
    ],
  });

  const content = response.choices[0]?.message?.content || "Failed to generate standup.";

  return {
    content,
    tokensUsed: response.usage?.total_tokens || 0,
    model: config.model,
  };
}

/**
 * Route to the appropriate LLM provider based on the model name.
 */
export async function generateStandup(
  config: LLMConfig,
  activity: GitHubActivity,
  userPrompt?: string
): Promise<StandupResult> {
  const model = config.model.toLowerCase();

  if (model.startsWith("claude") || model.startsWith("anthropic")) {
    return generateWithAnthropic(config, activity, userPrompt);
  }

  if (model.startsWith("gpt") || model.startsWith("o1") || model.startsWith("o3")) {
    return generateWithOpenAI(config, activity, userPrompt);
  }

  // Default to Anthropic
  return generateWithAnthropic(config, activity, userPrompt);
}
