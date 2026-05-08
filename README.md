# SOP Pristine Cleaners

Production-ready SaaS starter built with Next.js 16, TypeScript, Tailwind, shadcn-style UI primitives, Supabase auth, dark mode, and environment validation.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS 4 and shadcn/ui conventions
- Supabase SSR auth with protected dashboard routes
- Zod environment and form validation
- Dark mode via `next-themes`
- Mobile responsive marketing, auth, and dashboard screens

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.example .env.local
```

3. Fill in Supabase values from your project settings:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Run the app:

```bash
npm run dev
```

## Scripts

- `npm run dev` starts local development.
- `npm run build` creates a production build.
- `npm run start` serves the production build.
- `npm run lint` runs ESLint.
- `npm run typecheck` runs TypeScript without emitting files.

## Structure

- `src/app` contains routes, layouts, Server Actions, and route handlers.
- `src/components/ui` contains shadcn-style primitives.
- `src/components/marketing` contains public site UI.
- `src/components/dashboard` contains authenticated product UI.
- `src/lib/supabase` contains browser, server, and proxy session clients.
- `src/lib/validations` contains reusable Zod schemas.
- `proxy.ts` refreshes Supabase sessions and protects `/dashboard`.

## Deployment

Set the variables in `.env.example` in your hosting provider. `NEXT_PUBLIC_APP_URL` should match your deployed URL, and Supabase auth redirect URLs should include:

```txt
http://localhost:3000/auth/callback
https://your-domain.com/auth/callback
```
