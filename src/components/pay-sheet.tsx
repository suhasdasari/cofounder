import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { usePayReady } from "@/components/pay-provider";
import { clientPayConfigured, PRICE } from "@/lib/pay/config";

export type PayKind = "pitch" | "steal";

const LivePay = lazy(() =>
  import("@/components/pay-live").then((m) => ({ default: m.LivePay })),
);

export function PaySheet({
  kind,
  stealVerified,
  onSuccess,
  onCancel,
}: {
  kind: PayKind;
  stealVerified?: boolean;
  onSuccess: (txHash: string | "preview") => void;
  onCancel: () => void;
}) {
  const live = clientPayConfigured();
  const ready = usePayReady();
  const amountUsd =
    kind === "pitch" ? PRICE.pitchUsd : stealVerified ? PRICE.stealVerifiedUsd : PRICE.stealFreeRowUsd;

  if (live && ready) {
    return (
      <Suspense fallback={<p className="text-sm text-muted">Wallet layer loading…</p>}>
        <LivePay
          kind={kind}
          stealVerified={stealVerified}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      </Suspense>
    );
  }

  if (live && !ready) {
    return <p className="text-sm text-muted">Connecting Privy…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-display text-2xl">
        {kind === "pitch" ? `Pitch · $${amountUsd}` : `Steal · $${amountUsd}`}
      </p>
      <p className="text-sm text-muted">
        Real USDC needs your Privy app ID and a Base treasury address. Preview marks this paid so you can
        test the loop.
      </p>
      <Button size="lg" onClick={() => onSuccess("preview")}>
        Preview pay
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
