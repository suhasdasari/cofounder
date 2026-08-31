import { createFileRoute } from "@tanstack/react-router";
import { GameApp } from "@/components/game-app";
import { getBoard, getToday } from "@/lib/game/actions";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    duel: typeof search.duel === "string" ? search.duel : undefined,
  }),
  loader: async () => {
    const [today, board] = await Promise.all([getToday(), getBoard()]);
    return { today, board };
  },
  component: Home,
});

function Home() {
  const { duel } = Route.useSearch();
  const { today, board } = Route.useLoaderData();
  return <GameApp duelId={duel} initialToday={today} initialBoard={board} />;
}
