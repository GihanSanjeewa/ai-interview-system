# Inverview AI — Local setup

Follow these steps once. After the first run, you only need step 5.

## 1. Prerequisites

- **Node.js 20+** and **pnpm** (or npm)
- **Docker Desktop** (for MySQL + Redis)
- **Python 3.10+** (for the ML service)
- **FFmpeg** on PATH (Whisper needs it)

## 2. Start infrastructure

```bash
docker compose up -d mysql redis adminer
```

- MySQL at `localhost:3306` (root / root, db `inverview_ai`)
- Adminer UI at `http://localhost:8081`

## 3. Backend (TypeScript API)

```bash
cd backend
cp .env.example .env             # fill in real secrets for prod
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed                  # seeds sample jobs
npm run dev                      # → http://localhost:5000
```

Health: `GET http://localhost:5000/healthz`
API docs: every endpoint under `/api/v1/*`. WebSocket on `ws://localhost:5000/ws`.

## 4. ML service (Python)

```bash
cd ml-service
python -m venv venv
venv\Scripts\activate            # Windows. On *nix: source venv/bin/activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
# Set ANTHROPIC_API_KEY in .env or env
python app.py                    # → http://localhost:8000
```

> The TS backend gracefully falls back to heuristic scoring if the ML
> service is down, so you can develop without it.

## 5. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev                      # → http://localhost:5173
```

The Vite dev server proxies `/api` and `/ws` to the backend on `:5000`, so
no CORS headaches.

## Common tasks

| Want to…                       | Run                                 |
| ------------------------------ | ----------------------------------- |
| Inspect the DB                 | `cd backend && npx prisma studio`   |
| Reset the DB                   | `cd backend && npx prisma migrate reset` |
| Regenerate Prisma client       | `cd backend && npx prisma generate` |
| Re-seed jobs                   | `cd backend && npm run db:seed`     |
| Type-check the backend         | `cd backend && npm run typecheck`   |
| Build the backend              | `cd backend && npm run build`       |
| Build the frontend             | `cd frontend && npm run build`      |

## Troubleshooting

- **MySQL won't start**: port 3306 might already be in use. Stop any local MySQL.
- **`prisma migrate dev` hangs**: check `DATABASE_URL` matches the compose values.
- **Whisper errors on first call**: ensure FFmpeg is on PATH.
- **401 from frontend**: clear `iv_access` from localStorage and reload.
