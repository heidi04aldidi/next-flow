# NextFlow — LLM Workflow Builder

A production-ready, pixel-perfect Krea.ai-inspired LLM workflow builder. Build, connect, and run AI pipelines visually using a node-based canvas.

![NextFlow](https://nextflow-6rhf7198k-geethikas-projects-d5afde52.vercel.app/sign-up)

---

## Features

- **Visual Node Canvas** — React Flow with dot grid, pan/zoom, MiniMap
- **6 Node Types** — Text, Upload Image, Upload Video, LLM, Crop Image, Extract Frame
- **Type-Safe Connections** — Only compatible handle types can be connected
- **DAG Validation** — Cycles are prevented at the connection level
- **Parallel Execution** — Independent branches run concurrently via Trigger.dev
- **Selective Runs** — Run full workflow, selected nodes, or a single node (To be implemented)
- **Run History** — Full node-level execution details in right sidebar
- **Undo/Redo** — Full history for all canvas mutations (To be implemented)
- **Export/Import JSON** — Share workflows as portable JSON files
- **Clerk Auth** — Secure authentication with per-user workflow isolation
- **Persistent Storage** — Workflows and run history saved to PostgreSQL (Neon)
- **Pre-built Sample** — "Product Marketing Kit Generator" showcasing all features

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| State | Zustand |
| Canvas | React Flow |
| Auth | Clerk |
| Database | PostgreSQL via Neon + Prisma ORM |
| Task Runner | Trigger.dev v3 |
| File Uploads | Transloadit |
| AI | Google Gemini API |
| Validation | Zod |
| Icons | Lucide React |

---

## Prerequisites

- Node.js 18.17+
- npm / pnpm / yarn
- A Neon PostgreSQL database
- Accounts at: Clerk, Trigger.dev, Transloadit, Google AI Studio

---

## Getting API Keys

### 1. Google AI (Gemini)
1. Go to [Google AI Studio](https://aistudio.google.com)
2. Create a new API key
3. Copy key → `GOOGLE_GEMINI_API_KEY`

### 2. Clerk
1. Sign up at [clerk.com](https://clerk.com)
2. Create a new application
3. Copy **Publishable Key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
4. Copy **Secret Key** → `CLERK_SECRET_KEY`

### 3. Trigger.dev
1. Sign up at [trigger.dev](https://trigger.dev)
2. Create a new project
3. Copy **Secret Key** → `TRIGGER_SECRET_KEY`
4. Copy **Project ID** → update `trigger.config.ts` `project` field

### 4. Transloadit
1. Sign up at [transloadit.com](https://transloadit.com)
2. Get your **Auth Key** → `TRANSLOADIT_KEY`
3. Get your **Auth Secret** → `TRANSLOADIT_SECRET`
4. Create two Templates:
   - **Image upload template** (store/passthrough) → `TRANSLOADIT_IMAGE_TEMPLATE_ID`
   - **Video upload template** (store/passthrough) → `TRANSLOADIT_VIDEO_TEMPLATE_ID`

**Recommended Transloadit Template setup:**
```json
{
  "steps": {
    "store": {
      "use": ":original",
      "robot": "/s3/store",
      "credentials": "YOUR_S3_CREDENTIALS",
      "path": "nextflow/${unique_prefix}/${file.name}"
    }
  }
}
```
> Or use the `/file/filter` robot with `/cdn/delivery` for a simpler passthrough.

### 5. Neon PostgreSQL
1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy **Connection String** → `DATABASE_URL`

---

## Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/nextflow.git
cd nextflow

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
```

Edit `.env.local` and fill in all required values:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/workflow
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/workflow

# Database (Neon)
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Google Gemini
GOOGLE_GEMINI_API_KEY=AIza...

# Trigger.dev
TRIGGER_SECRET_KEY=tr_dev_...

# Transloadit
TRANSLOADIT_KEY=your_key
TRANSLOADIT_SECRET=your_secret
TRANSLOADIT_IMAGE_TEMPLATE_ID=your_image_template_id
TRANSLOADIT_VIDEO_TEMPLATE_ID=your_video_template_id
```

---

## Database Setup

```bash
# Push the Prisma schema to your database
npx prisma db push

# (Optional) Open Prisma Studio to inspect your data
npx prisma studio
```

---

## Running Locally

You need **two terminals** — one for Next.js and one for Trigger.dev.

### Terminal 1: Next.js Dev Server
```bash
npm run dev
```
App available at [http://localhost:3000](http://localhost:3000)

### Terminal 2: Trigger.dev Dev Worker
```bash
npx trigger.dev@latest dev
```
This registers your tasks with Trigger.dev's cloud and runs them locally.

---

## Project Structure

```
nextflow/
├── prisma/
│   └── schema.prisma          # Database models
├── trigger/
│   ├── llmTask.ts             # Gemini API task
│   ├── cropImageTask.ts       # FFmpeg crop task
│   └── extractFrameTask.ts    # FFmpeg frame extraction task
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── run/route.ts           # Execute workflow
│   │   │   ├── upload/
│   │   │   │   ├── image/route.ts     # Upload image to Transloadit
│   │   │   │   └── video/route.ts     # Upload video to Transloadit
│   │   │   └── workflows/
│   │   │       ├── save/route.ts      # Save workflow
│   │   │       └── [workflowId]/
│   │   │           └── runs/route.ts  # Get run history
│   │   ├── workflow/page.tsx          # Main editor page
│   │   ├── sign-in/page.tsx
│   │   ├── sign-up/page.tsx
│   │   ├── layout.tsx
│   │   ├── page.tsx                   # Landing / redirect
│   │   └── globals.css
│   ├── components/
│   │   ├── canvas/
│   │   │   └── WorkflowCanvas.tsx     # React Flow canvas
│   │   ├── layout/
│   │   │   ├── TopToolbar.tsx         # Save, Run, Export, Undo/Redo
│   │   │   └── WorkflowEditor.tsx     # Root client layout
│   │   ├── nodes/
│   │   │   ├── NodeShell.tsx          # Shared node wrapper
│   │   │   ├── TextNode.tsx
│   │   │   ├── UploadImageNode.tsx
│   │   │   ├── UploadVideoNode.tsx
│   │   │   ├── LLMNode.tsx
│   │   │   ├── CropImageNode.tsx
│   │   │   └── ExtractFrameNode.tsx
│   │   └── sidebar/
│   │       ├── LeftSidebar.tsx        # Node palette
│   │       └── RightSidebar.tsx       # Run history
│   ├── lib/
│   │   ├── db/
│   │   │   ├── client.ts              # Prisma singleton
│   │   │   └── workflows.ts           # DB queries
│   │   ├── store/
│   │   │   └── workflowStore.ts       # Zustand global state
│   │   ├── trigger/
│   │   │   └── executor.ts            # Workflow execution engine
│   │   ├── utils/
│   │   │   ├── dag.ts                 # Topological sort, cycle detection
│   │   │   ├── index.ts               # Shared utilities
│   │   │   └── sampleWorkflow.ts      # Pre-built sample workflow
│   │   └── validations/
│   │       └── schemas.ts             # Zod schemas
│   ├── middleware.ts                  # Clerk route protection
│   └── types/
│       └── index.ts                   # All TypeScript types
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── trigger.config.ts
└── tsconfig.json
```

---

## Deployment (Vercel)

### 1. Push to GitHub
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Import to Vercel
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Add all environment variables from `.env.local`
4. Deploy

### 3. Deploy Trigger.dev Tasks
```bash
npx trigger.dev@latest deploy
```

### 4. Update Clerk Allowed URLs
In your Clerk dashboard, add your Vercel URL to:
- Allowed Redirect URLs
- Allowed Origins

---

## Node Types Reference

| Node | Inputs | Outputs | Execution |
|---|---|---|---|
| **Text** | — | `output` (text) | Instant (no task) |
| **Upload Image** | — | `output` (image URL) | Transloadit upload |
| **Upload Video** | — | `output` (video URL) | Transloadit upload |
| **LLM** | `system_prompt`, `user_message`, `images` | `output` (text) | Trigger.dev → Gemini |
| **Crop Image** | `image_url`, `x`, `y`, `width`, `height` | `output` (image URL) | Trigger.dev → FFmpeg |
| **Extract Frame** | `video_url`, `timestamp` | `output` (image URL) | Trigger.dev → FFmpeg |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Delete` / `Backspace` | Delete selected nodes/edges |
| `Scroll` | Zoom canvas |
| `Drag` (background) | Pan canvas |

---

## Sample Workflow

The app ships with a **"Product Marketing Kit Generator"** sample workflow that demonstrates:
- All 6 node types
- Parallel branch execution (Branch A: image → Branch B: video)
- Convergence point (LLM node waiting for both branches)
- Input chaining (nodes feeding into other nodes)

Load it from the left sidebar's **"Marketing Kit"** button.

---

## Architecture Notes

### Execution Engine
The execution engine (`executor.ts`) uses Kahn's algorithm to produce a topological sort of the DAG, grouping nodes into dependency levels. Each level is executed in parallel using `Promise.all`, so independent branches run concurrently. Nodes whose upstream dependencies failed are skipped automatically.

### Connection Validation
Two layers of protection:
1. `isValidConnection` in the store blocks type-unsafe connections at UI level
2. `wouldCreateCycle` prevents circular dependencies in real time

### Handle Types
Connections are typed: `text → text`, `image → image`, `video → video`. The LLM node's `images` handle accepts image-type connections; its `system_prompt` and `user_message` handles accept text.

---

## License

MIT
