# standup.ai

AI-powered standup generator from GitHub activity via MCP (Model Context Protocol).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Vite + React + TS + Tailwind/ShadCN)                │
│  Auth0 login → ChatGPT-style input → Display streamed standup   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ POST /api/standup/generate
                           │ (Bearer JWT)
┌──────────────────────────▼──────────────────────────────────────┐
│  Backend (Express + Prisma + TypeScript)                        │
│                                                                  │
│  1. Validate JWT via Auth0                                       │
│  2. Spawn per-user MCP child process (stdio transport)           │
│  3. MCP Server fetches GitHub data with user's token             │
│  4. Send structured activity → LLM (Claude/GPT)                 │
│  5. Save standup → PostgreSQL                                    │
│  6. Terminate MCP process                                        │
│  7. Return generated standup                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

**Per-user MCP isolation**: Each standup generation spawns a dedicated MCP server
child process. This ensures GitHub tokens never leak between users, processes are
automatically cleaned up, and crashes in one user's session don't affect others.

**Bring-your-own API key**: Users provide their own LLM API key (Anthropic or OpenAI).
Keys are AES-256-GCM encrypted at rest in PostgreSQL.

**Auth0 with GitHub social**: Primary login is GitHub OAuth via Auth0, which gives us
the GitHub access token for MCP. Email/password fallback available.

## Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Auth0 account with GitHub social connection configured

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Edit both files with your Auth0 + database credentials
```

### 3. Set up database
```bash
npm run db:migrate     # Run Prisma migrations
```

### 4. Start development
```bash
npm run dev            # Starts both frontend (5173) and backend (3001)
```

## Auth0 Configuration

1. Create a **Single Page Application** in Auth0
2. Enable **GitHub** social connection (Authentication → Social)
3. Set Allowed Callback URLs: `http://localhost:5173`
4. Set Allowed Logout URLs: `http://localhost:5173`
5. Create an **API** with identifier matching `AUTH0_AUDIENCE`

The GitHub social connection provides the access token needed for MCP
to query the GitHub API on behalf of the user.

## Project Structure

```
standup-ai/
├── frontend/
│   └── src/
│       ├── components/    # React components (AuthProvider, etc.)
│       ├── hooks/         # Custom React hooks
│       ├── lib/           # API client, utilities
│       └── pages/         # Route pages
├── backend/
│   └── src/
│       ├── routes/        # Express route handlers
│       │   ├── standup.ts # POST /generate, GET /history
│       │   └── user.ts    # GET /me, PUT /settings
│       ├── services/      # Business logic
│       │   ├── llm.ts     # LLM generation (Claude/GPT)
│       │   ├── prisma.ts  # Database client
│       │   └── encryption.ts
│       ├── mcp/
│       │   ├── manager.ts       # Spawns/manages MCP child processes
│       │   └── github-server.ts # MCP server (runs as child process)
│       ├── middleware/    # Auth, error handling
│       └── prisma/        # Schema, migrations
└── package.json           # Monorepo root
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/standup/generate` | Generate standup (spawns MCP → LLM) |
| GET | `/api/standup/history` | Paginated standup history |
| GET | `/api/standup/:id` | Single standup |
| DELETE | `/api/standup/:id` | Delete standup |
| GET | `/api/user/me` | Current user profile |
| PUT | `/api/user/settings` | Update preferences |
| POST | `/api/user/github-token` | Store GitHub token |
| POST | `/api/user/api-key` | Store LLM API key |
