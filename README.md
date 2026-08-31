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

## Local

```bash
npm install
npm run dev
```

Preview uses an in-memory Postgres (PGLite). Production needs `DATABASE_URL`
(Neon). Schema lives in `migrations/`.

## Stack

TanStack Start · React 19 · Tailwind v4 · Postgres
