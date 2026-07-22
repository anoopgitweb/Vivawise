# Vivawise

Vivawise is a mobile-first AI viva practice application. Students upload their own syllabus and learning material, practise adaptive oral-exam questions, and receive structured scoring and feedback grounded in those documents.

## What is included

- OpenAI Responses API with GPT-5.6 Terra by default
- File Search over a separate vector store for each user
- Private PDF, DOCX and TXT uploads
- Per-user document, session and answer records
- Adaptive follow-up questions and structured evaluation
- Responsive dashboard, practice, progress and settings views
- Cloudflare D1 metadata and R2 document storage through OpenAI Sites

## Windows quick start

1. Double-click `Configure-OpenAI-Key.bat` once and securely enter an API key.
2. Double-click `Start-Vivawise.bat`.
3. Keep the command window open while using `http://localhost:3000`.

The local API key is saved in `.env.local`, which is excluded from Git.

## Manual setup

```powershell
corepack pnpm install
Copy-Item .env.example .env.local
# Add OPENAI_API_KEY to .env.local
corepack pnpm exec vinext dev
```

## User data isolation

The server derives a one-way identifier from the authenticated user's email. Each document is stored under a user-specific R2 prefix, recorded with that owner in D1, and indexed in that user's own OpenAI vector store. Viva and document endpoints independently verify the authenticated owner. The frontend never supplies or chooses a user ID.

Local development uses `local-student@vivawise.dev`. Hosted requests require the authenticated user header supplied by the Sites platform.

## Prototype admin

Open **Admin** and sign in with `admin` / `Vivawise@2026`. The admin can create mock-viva topics, upload topic-specific source documents, and assign them to an exact student email. Students only see assignments matching the authenticated email supplied by the host. Local development uses `local-student@vivawise.dev`.

These credentials are temporary and hard-coded server-side for prototype testing. Replace them with Supabase authentication and role-based authorization before public use.

## Supabase database setup

1. Open the Supabase SQL Editor for the Vivawise project.
2. Copy and run `supabase/migrations/20260722_vivawise.sql` once.
3. Start Vivawise and create the first account. The database trigger makes the first registered account the administrator; later accounts are students.

The schema contains users/profiles, named tests, test documents, assignments, attempts and answers. Row Level Security restricts students to their own assignments and attempts. Supporting files are stored in the private `test-documents` bucket under their test ID.

## Environment

- `OPENAI_API_KEY` — required; keep this secret
- `OPENAI_MODEL` — optional; defaults to `gpt-5.6-terra`

Never commit `.env.local` or place the API key in frontend code.
