# cofounder.lol

**Equity Splitter** — five cofounder fights, one slider. New five every 3 hours.

Drag who gets the company. Your score is against a hidden house line, not a live
crowd bots can move. One official run per browser per round. Pin a founder card
(logo, name, site, pitch). Round, daily, and all-time boards. Founders can list
a real fight; the next free slot becomes case 01.

Live at [cofounder.lol](https://cofounder.lol).

## Play

1. Split five cases in about 45 seconds.
2. Get a fairness score and a splitter archetype.
3. Pin a profile card after an official run.
4. Challenge a cofounder, a board name, or a random founder (`/?duel=`).
5. Queue a real founder fight for a coming round.

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
