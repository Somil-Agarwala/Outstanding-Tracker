# PayTrack — Distribution Outstanding Manager

A web app for tracking credit invoices, outstanding payments, and dealer risk across multiple locations and companies.

---

## Tech Stack

- **Frontend** — React + Vite + Tailwind CSS
- **Database** — Supabase (PostgreSQL)
- **Hosting** — Vercel
- **Auth** — Supabase Auth

---

## Features

- Invoice management with auto-calculated due dates, balances, and delay days
- Multi-location, multi-company support with role-based access
- Automated dealer risk scoring (0–100) via database triggers
- Watchlist for high-risk dealers with full payment history
- Dashboard with location-wise and company-wise breakdowns
- Reports with filterable Excel exports (Outstanding, Watchlist, Full 5-sheet)
- PDC tracking, calling remarks, and call alerts

---

## Roles

| Role | Access |
|---|---|
| `admin` | All locations, all data, master data management |
| `location_manager` | Own location only |

---

## Project Structure

```
src/
├── components/
│   ├── Dashboard.jsx
│   ├── layout/          — Navbar, Login
│   ├── invoices/        — InvoicesPage, InvoiceModal, PaidInvoicesPage
│   ├── risk/            — WatchlistPage
│   ├── master/          — MasterPage (stockists, PSRs)
│   └── reports/         — ReportsPage
├── hooks/               — useAuth, useInvoices, useWatchlist, useMasterData
└── lib/                 — supabase.js, utils.js

supabase/
└── schema.sql           — Full DB schema, triggers, views, RLS policies
```

---

## Setup

**1. Supabase**
- Create a project at supabase.com
- Run `supabase/schema.sql` in the SQL Editor
- Create users in Authentication → Users
- Insert user profiles:
```sql
-- Get location UUIDs first
SELECT id, name FROM locations;

INSERT INTO user_profiles (id, full_name, role, location_id)
VALUES ('auth-user-uid', 'Name', 'admin', 'location-uuid');
```

**2. Environment**
```
cp .env.example .env
```
Fill in:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**3. Run locally**
```bash
npm install
npm run dev
```

**4. Deploy**
Push to GitHub → import on vercel.com → add the two env vars → Deploy.

---

## Risk Score Algorithm

Scores 0–100 computed automatically on every invoice change.

| Component | Weight | Basis |
|---|---|---|
| Overdue ratio | 40 pts | Overdue invoices ÷ total invoices |
| Avg delay days | 30 pts | Average days past due (capped 90d) |
| Overdue amount | 20 pts | Total overdue balance (capped ₹5L) |
| Repeat count | 10 pts | Number of times overdue (3+ = max) |

**Levels:** Low (0–24) · Medium (25–49) · High (50–74) · Critical (75–100)

Dealers scoring 50+ are auto-added to the watchlist.

---

## Adding a New Migration

Run directly in Supabase SQL Editor. Always `drop view if exists invoice_details` before recreating it with new columns.
