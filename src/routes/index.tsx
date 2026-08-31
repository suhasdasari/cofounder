import { createFileRoute } from "@tanstack/react-router";
import { ArenaApp } from "@/components/arena-app";
import { IntroGate } from "@/components/intro-gate";
import { getArena } from "@/lib/game/arena";

export const Route = createFileRoute("/")({
  loader: async () => {
    const arena = await getArena({ data: {} });
    return { arena };
  },
  component: Home,
});

function Home() {
  const { arena } = Route.useLoaderData();
  return (
    <IntroGate>
      <ArenaApp initial={arena} />
    </IntroGate>
  );
}
