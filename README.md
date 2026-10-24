# Bridge Builder — System Design Studio

HackOHI/O 2026 "Bridge Builder Challenge" (Honda / 99P Labs) demo.

Students architect solutions to real system-design problems; industry pros contribute in
minutes (quick feedback + design tweaks). Every solution, tweak, and piece of feedback is
public and becomes a visible record of growth. The hero feature is a split-screen **Studio**:
structured guided-spec prompts on the left, a live Mermaid architecture diagram (generated via
Amazon Bedrock) on the right.

- **Concept & rules:** `master.md` (read first)
- **Living spec / API contract:** `docs/specs/bridge-builder.md` (single source of truth)
- **Challenge brief:** `docs/honda_challenge.md`

## Stack

Full AWS serverless: React + Vite (TS) frontend on S3/CloudFront · API Gateway + Lambda
(Node 22 / TS) · DynamoDB (single table) · Amazon Bedrock (Converse / Claude) for diagrams.

## Prerequisites

- Node.js 22.x and npm
- [Docker](https://www.docker.com/) (to run DynamoDB Local for local dev)
- For deploy / Bedrock: AWS credentials, and a Claude model enabled in Amazon Bedrock

### Bedrock diagram generation

`POST /ai/diagram` uses the Bedrock Converse API only when a user clicks **Update Blueprint**.
Local or deployed calls need ordinary AWS SDK credentials plus access to the configured model or
inference profile in `BEDROCK_REGION`. Keep credentials outside `.env`; use your normal AWS CLI
profile or session. Set `BEDROCK_MODEL_ID` to a model/profile ID that is enabled for your account
and region. If a model requires cross-region inference, use its supported prefixed profile ID.
The API returns a safe 502 message when Bedrock is unavailable; the UI keeps the last successful
diagram visible.

## One-command local start

```bash
# 1. Install everything (root tooling + backend + frontend)
npm install
npm run install:all

# 2. Start DynamoDB Local (in its own terminal; needs Docker)
docker run -p 8000:8000 amazon/dynamodb-local

# 3. Create the local table + seed problems (one time, or after editing seed data)
Copy-Item .env.example .env  # defaults already point at DynamoDB Local
npm run db:setup
npm run seed

# 4. Run backend + frontend together
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000 (frontend calls it via the `/api` proxy)

You'll know it works when the header badge reads **Connected**.

### Adding a problem

Drop a new entry into `backend/seed/problems.json` and re-run `npm run seed`. Each entry
needs a unique lowercase kebab-case `id`, non-empty `title`, `hook`, `description`,
`constraints`, and `hintPills`. Exactly one entry must have `"isWeekly": true` (the weekly
challenge). The JSON file is authoritative for the seeded catalog: re-seeding upserts entries
whose ids remain and retires existing seeded problems omitted from the file. Do not remove an
entry unless it should disappear from the Hub.

## Environment

Copy `.env.example` to `.env` and fill in as needed. `.env` is gitignored — never commit
real values. Key names:

| Key | Purpose |
|-----|---------|
| `AWS_REGION` | AWS region for SDK calls / deploy |
| `TABLE_NAME` | DynamoDB table name (default `bridge-builder`) |
| `DYNAMODB_ENDPOINT` | Set to `http://localhost:8000` for local; unset for real AWS |
| `BEDROCK_MODEL_ID` | Enabled Bedrock model or inference-profile ID for diagram generation |
| `BEDROCK_REGION` | Region for Bedrock (defaults to `AWS_REGION`; same as Lambda region after deploy) |
| `PORT` | Local backend port (default 4000) |

## Deploy (backend)

Infra-as-code is AWS SAM (`backend/template.yaml`): DynamoDB table, Lambda, HTTP API, and the
Bedrock invocation permission. Task 5 requires both `BedrockModelId` and `BedrockModelArn` at
deploy time. The ARN must name the exact foundation model or inference profile selected by the
model ID, so the Lambda cannot invoke unrelated models.

```bash
cd backend
npm run build        # bundles dist/lambda.mjs with esbuild
sam deploy --guided  # first time; provide BedrockModelId + matching BedrockModelArn
```

The frontend is a static build (`npm run build --prefix frontend`) deployable to S3 +
CloudFront. Point it at the deployed API with `VITE_API_BASE=<api-url>` at build time.

## Tests

```bash
npm test             # backend contract tests + frontend browser tests
npm run typecheck    # typecheck backend + frontend
```

## Project layout

```
backend/    Lambda handlers + framework-agnostic router, DynamoDB repo, Bedrock, SAM template
frontend/   React + Vite SPA; all backend calls go through src/api.ts (single seam)
docs/       challenge brief, README, and specs/ (bridge-builder.md is the contract)
agents/     multi-agent role definitions (see master.md)
```
