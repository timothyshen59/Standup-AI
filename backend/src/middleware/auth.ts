import { auth } from "express-oauth2-jwt-bearer";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma.js";
import { encrypt } from "../services/encryption.js";

// Auth0 JWT validation middleware
export const requireAuth = auth({
  audience: process.env.AUTH0_AUDIENCE!,
  issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}`,
  tokenSigningAlg: "RS256",
});

// Extend Express Request with user info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userAuth0Id?: string;
    }
  }
}

// Custom claim namespace — must match the Auth0 Action
const GITHUB_TOKEN_CLAIM = "https://standup-ai.dev/github_token";

export async function resolveUser(req: Request, res: Response, next: NextFunction) {
  try {
    const payload = req.auth?.payload as any;
    //Debugging
    console.log("[auth] JWT payload:", JSON.stringify(payload, null, 2));

    const auth0Id = payload?.sub;
    if (!auth0Id) {
      res.status(401).json({ error: "Missing user identity" });
      return;
    }

    const githubToken: string | undefined = payload?.[GITHUB_TOKEN_CLAIM];

    const user = await prisma.user.upsert({
      where: { auth0Id },
      update: {
        ...(githubToken ? { githubToken: encrypt(githubToken) } : {}),
      },
      create: {
        auth0Id,
        email: payload?.email || `${auth0Id}@unknown`,
        name: payload?.name || null,
        githubUsername: payload?.nickname || null,
        ...(githubToken ? { githubToken: encrypt(githubToken) } : {}),
      },
    });

    req.userId = user.id;
    req.userAuth0Id = auth0Id;
    next();
  } catch (err) {
    next(err);
  }
}