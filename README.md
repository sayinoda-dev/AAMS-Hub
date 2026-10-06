# AAMS Science Club Platform

MVP web platform for a school science club: students read news, submit ideas, and join projects with group codes; admins publish news and review ideas.

## Stack

- **Frontend:** plain HTML, CSS, vanilla JavaScript (multi-page)
- **Backend:** Node.js + Express
- **Database:** PostgreSQL (`pg`), SQL migrations in `db/migrations/`
- **Auth:** `express-session` + `connect-pg-simple`, bcrypt passwords, role-based access

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

## Setup

1. **Clone and install**

   ```bash
   cd "/home/linux/Projects/AAMS Project Management"
   npm install
   ```

2. **Environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env`: set `DATABASE_URL`, a strong `SESSION_SECRET`, and optionally `GROUP_CODE_EXPIRY_DAYS`.

3. **Create database**

   ```bash
   createdb science_club
   ```

4. **Migrate and seed**

   ```bash
   npm run db:setup
   ```

5. **Run**

   ```bash
   npm start
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Seed accounts

| Role    | Email                  | Password             |
| ------- | ---------------------- | -------------------- |
| Admin   | _cant_tell_this_one_   | _cant_tell_this_one_ |
| Student | `maya@student.local`   | `Student123!`        |
| Student | `jordan@student.local` | `Student123!`        |
| Student | `sam@student.local`    | `Student123!`        |

Change these before any real deployment.

## User flows

- **Student:** Sign in as Student → **News** dashboard → submit idea, read news, or open **Projects** and join with a group code.
- **Admin:** Sign in as Admin → dashboard → publish news or review pending ideas (accept creates a project + group code; reject closes the idea).

## Branding

Edit placeholder copy and logo markup in `public/js/config.js`. Optional Apple Garamond files go in `public/fonts/` (see `public/fonts/README.txt`).

## Scripts

| Command              | Description          |
| -------------------- | -------------------- |
| `npm start`          | Start server         |
| `npm run dev`        | Start with `--watch` |
| `npm run db:migrate` | Apply migrations     |
| `npm run db:seed`    | Seed sample data     |

## Security notes

- Login is rate-limited; sessions use HTTP-only cookies.
- CSRF tokens required on mutating API requests.
- All SQL uses parameterized queries; HTML output is escaped on the client.

## Project layout

```
server.js
routes/          API routes
middleware/      auth, CSRF
db/              migrations, seed, pool
public/          HTML pages, css, js, fonts
lib/             sanitize helpers
```
