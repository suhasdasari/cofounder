# cofounder.lol

**Equity Splitter** — five cofounder fights, one slider. Same five until midnight UTC.

Drag who gets the company. Your score is against a hidden house line, not a live
crowd bots can move. One official run per browser per day. Top 10 pin a name,
handle, and URL on the homepage until the day rolls.

Live at [cofounder.lol](https://cofounder.lol).

## Play

1. Split five cases in about 45 seconds.
2. Get a fairness score and a splitter archetype.
3. If you land top 10, claim a promo slot.
4. Challenge a cofounder with a duel link (`/?duel=`).
5. Queue a real founder fight for a future day.

Satire. Not affiliated with cofounder.co.

## Where things live

| Piece | Where |
|---|---|
| App | Vercel (this GitHub repo auto-deploys) |
| Data | Neon Postgres — scores, claimed names, queued fights, duels |
| Owner desk | `/ops` — all stored rows + JSON download |
| Code | [github.com/suhasdasari/cofounder](https://github.com/suhasdasari/cofounder) |

The live preview in Grok uses a throwaway store. Publish / Vercel with a
`DATABASE_URL` is the real database. Preview rows do not copy over.

In Vercel: **Storage → Create Database → Neon**. That sets `DATABASE_URL`.
Then attach `cofounder.lol` under the project's Domains.

## Stack

TanStack Start · React 19 · Tailwind v4 · Postgres (Neon)
