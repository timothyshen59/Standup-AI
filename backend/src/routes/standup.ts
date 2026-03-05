import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { requireAuth, resolveUser } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { prisma } from "../services/prisma.js";
import { decrypt } from "../services/encryption.js";
import { spawnMCPSession, fetchGitHubActivity, terminateSession } from "../mcp/manager.js";
import { generateStandup } from "../services/llm.js";

export const standupRouter = Router();

// All routes require authentication
standupRouter.use(requireAuth);
standupRouter.use(resolveUser);

// ─── Validation Schemas ───────────────────────────────────────

const generateSchema = z.object({
  prompt: z.string().max(2000).optional(),
  apiKey: z.string().min(1, "API key is required"),
  model: z.string().default("claude-sonnet-4-20250514"),
  window: z.string().default("24h"),
  repos: z.array(z.string()).optional(),
});

// ─── POST /api/standup/generate ───────────────────────────────
// Main endpoint: spawns MCP, fetches GitHub data, generates standup
standupRouter.post("/generate", async (req: Request, res: Response, next: NextFunction) => {
  let mcpSessionId: string | null = null;

  try {
    // Validate request body
    const body = generateSchema.parse(req.body);
    const userId = req.userId!;

    // Get user's GitHub token from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { settings: true },
    });

    if (!user?.githubToken) {
      throw new AppError(400, "GitHub not connected. Please connect your GitHub account.", "GITHUB_NOT_CONNECTED");
    }

    // Decrypt the stored GitHub token
    const githubToken = decrypt(user.githubToken);

    // 1. Spawn a dedicated MCP server for this user
    const mcpSession = await spawnMCPSession(userId, githubToken);
    mcpSessionId = mcpSession.id;

    // 2. Fetch GitHub activity via MCP
    const activity = await fetchGitHubActivity(mcpSession, {
      window: body.window,
      repos: body.repos || user.settings?.repos || [],
      excludeRepos: user.settings?.excludeRepos || [],
    });

    // 3. Generate standup text via LLM
    const result = await generateStandup(
      { apiKey: body.apiKey, model: body.model },
      activity,
      body.prompt
    );

    // 4. Save to database
    const standup = await prisma.standup.create({
      data: {
        userId,
        content: result.content,
        prompt: body.prompt || null,
        repos: activity.repos,
        model: result.model,
        tokensUsed: result.tokensUsed,
      },
    });

    // 5. Terminate MCP session (fire-and-forget)
    terminateSession(mcpSession.id).catch(console.error);
    mcpSessionId = null;

    res.json({
      standup: {
        id: standup.id,
        content: standup.content,
        repos: standup.repos,
        model: standup.model,
        tokensUsed: standup.tokensUsed,
        createdAt: standup.createdAt,
      },
    });
  } catch (err) {
    // Always clean up MCP session on error
    if (mcpSessionId) {
      terminateSession(mcpSessionId).catch(console.error);
    }

    if (err instanceof z.ZodError) {
      next(new AppError(400, `Validation error: ${err.errors.map(e => e.message).join(", ")}`));
    } else {
      next(err);
    }
  }
});

// ─── GET /api/standup/history ─────────────────────────────────
// Fetch paginated standup history
standupRouter.get("/history", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [standups, total] = await Promise.all([
      prisma.standup.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          content: true,
          repos: true,
          model: true,
          tokensUsed: true,
          createdAt: true,
        },
      }),
      prisma.standup.count({ where: { userId } }),
    ]);

    res.json({
      standups,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/standup/:id ─────────────────────────────────────
standupRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const standup = await prisma.standup.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
    });

    if (!standup) {
      throw new AppError(404, "Standup not found");
    }

    res.json({ standup });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/standup/:id ──────────────────────────────────
standupRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const standup = await prisma.standup.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });

    if (!standup) {
      throw new AppError(404, "Standup not found");
    }

    await prisma.standup.delete({ where: { id: standup.id } });
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});
