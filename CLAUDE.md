# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Footprint** is a self-hosted, end-to-end encrypted password manager built with Next.js. The master password never leaves the client — all encryption/decryption happens in the browser using Web Crypto API (PBKDF2 + AES-GCM).

## Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm start        # Start production server
npm run lint     # Run ESLint
```

No test suite is configured.

## Required Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Check `/api/health` to verify all env vars are present at runtime.

## Architecture

### Stack
- **Framework:** Next.js (App Router)
- **Auth:** Clerk (`proxy.ts` is the middleware — named non-standardly, but it exports `clerkMiddleware`)
- **Database:** Supabase — single `vaults` table with `user_id` and `vault` columns
- **Styling:** Tailwind CSS v4

### Security Model
- `lib/crypto.ts` — `deriveKey(password, userId)` uses PBKDF2 (100k iterations, SHA-256) with `userId` as salt; `encryptData`/`decryptData` use AES-GCM
- The encrypted blob is stored both in Supabase (via `/api/vault`) and `localStorage` (key: `footprint_vault`, managed by `lib/vaultLocal.ts`)
- `/api/vault` authenticates via Clerk server-side and uses the Supabase **service role key** — not the anon key

### Key Files
- `app/vault/page.tsx` — the entire vault UI (~600+ lines, single client component). Contains password strength analysis, generation, import/export (CSV + encrypted), bulk ops, trash, tags, idle-lock timeout, and postMessage communication with the extension.
- `app/api/vault/route.ts` — GET/POST for encrypted vault blob. Accepts both `vault` and `encryptedVault` keys for backwards compatibility.
- `footprint-extension/` — Manifest V3 Chrome extension. Reads decrypted vault from `localStorage` and autofills via postMessage to the vault page.

### Data Flow
1. User logs in via Clerk → vault page loads
2. User enters master password → `deriveKey` produces a CryptoKey
3. Encrypted blob fetched from Supabase → decrypted client-side → vault state populated
4. All writes encrypt in-browser then POST to `/api/vault` and save to `localStorage`

### Path Alias
`@/*` maps to the repo root (configured in `tsconfig.json`).
