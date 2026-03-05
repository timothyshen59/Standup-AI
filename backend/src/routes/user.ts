import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { requireAuth, resolveUser } from "../middleware/auth.js";
import { AppError } from "../middleware/error.js";
import { prisma } from "../services/prisma.js";
import { encrypt } from "../services/encryption.js";

export const userRouter = Router();

userRouter.use(requireAuth);
userRouter.use(resolveUser);

// ─── GET /api/user/me ─────────────────────────────────────────
userRouter.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      include: { settings: true },
    });

    if (!user) throw new AppError(404, "User not found");

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        githubUsername: user.githubUsername,
        githubConnected: !!user.githubToken,
        hasApiKey: !!user.llmApiKey,
        preferredModel: user.preferredModel,
        settings: user.settings
          ? {
              activityWindow: user.settings.activityWindow,
              repos: user.settings.repos,
              excludeRepos: user.settings.excludeRepos,
              standupFormat: user.settings.standupFormat,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/user/settings ───────────────────────────────────
const settingsSchema = z.object({
  preferredModel: z.string().optional(),
  activityWindow: z.enum(["12h", "24h", "48h", "7d"]).optional(),
  repos: z.array(z.string()).optional(),
  excludeRepos: z.array(z.string()).optional(),
  standupFormat: z.enum(["standard", "brief", "detailed"]).optional(),
});

userRouter.put("/settings", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = settingsSchema.parse(req.body);
    const userId = req.userId!;

    // Update user-level settings
    if (body.preferredModel) {
      await prisma.user.update({
        where: { id: userId },
        data: { preferredModel: body.preferredModel },
      });
    }

    // Upsert user settings
    const settings = await prisma.userSettings.upsert({
      where: { userId },
      update: {
        ...(body.activityWindow && { activityWindow: body.activityWindow }),
        ...(body.repos && { repos: body.repos }),
        ...(body.excludeRepos && { excludeRepos: body.excludeRepos }),
        ...(body.standupFormat && { standupFormat: body.standupFormat }),
      },
      create: {
        userId,
        activityWindow: body.activityWindow || "24h",
        repos: body.repos || [],
        excludeRepos: body.excludeRepos || [],
        standupFormat: body.standupFormat || "standard",
      },
    });

    res.json({ settings });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, `Validation error: ${err.errors.map(e => e.message).join(", ")}`));
    } else {
      next(err);
    }
  }
});

// ─── POST /api/user/github-token ──────────────────────────────
// Store encrypted GitHub token (from Auth0 social connection or manual input)
const tokenSchema = z.object({
  token: z.string().min(1, "GitHub token is required"),
});

userRouter.post("/github-token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = tokenSchema.parse(req.body);

    // Encrypt before storing
    const encrypted = encrypt(token);

    await prisma.user.update({
      where: { id: req.userId! },
      data: { githubToken: encrypted },
    });

    res.json({ connected: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0].message));
    } else {
      next(err);
    }
  }
});

// ─── POST /api/user/api-key ───────────────────────────────────
// Store encrypted LLM API key
const apiKeySchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
});

userRouter.post("/api-key", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { apiKey } = apiKeySchema.parse(req.body);
    const encrypted = encrypt(apiKey);

    await prisma.user.update({
      where: { id: req.userId! },
      data: { llmApiKey: encrypted },
    });

    res.json({ stored: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(new AppError(400, err.errors[0].message));
    } else {
      next(err);
    }
  }
});
