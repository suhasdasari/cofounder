import { usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
import { useState } from "react";
import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import { Button } from "@/components/ui/button";
import {
  BASE_RPC,
  encodeEthToUsdcSwap,
  encodeUsdcTransfer,
  erc20Abi,
  POOL_FEES,
  QUOTER_V2,
  quoterAbi,
  SWAP_ROUTER02,
  USDC,
  usdcUnits,
  WETH,
} from "@/lib/pay/base";
import { getTreasury, PRICE } from "@/lib/pay/config";

export type PayKind = "pitch" | "steal";

const publicClient = createPublicClient({
  chain: base,
  transport: http(BASE_RPC),
});

export function LivePay({
  kind,
  stealVerified,
  onSuccess,
  onCancel,
}: {
  kind: PayKind;
  stealVerified?: boolean;
  onSuccess: (txHash: string) => void;
  onCancel: () => void;
}) {
  const { ready, authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const treasury = getTreasury();
  const amountUsd =
    kind === "pitch" ? PRICE.pitchUsd : stealVerified ? PRICE.stealVerifiedUsd : PRICE.stealFreeRowUsd;
  const amount = usdcUnits(amountUsd);

  async function pay() {
    if (!treasury) {
      setErr("Treasury address is missing.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const address = (
        wallets.find((w) => (w as { chainType?: string }).chainType !== "solana")?.address ||
        user?.wallet?.address
      ) as Address | undefined;
      if (!address) {
        setErr("No wallet yet. Sign in again.");
        setBusy(false);
        return;
      }
      const usdcBal = (await publicClient.readContract({
        address: USDC,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;

      let hash: `0x${string}`;
      if (usdcBal >= amount) {
        const sent = await sendTransaction(
          {
            to: USDC,
            data: encodeUsdcTransfer(treasury, amount),
            chainId: base.id,
          },
          { uiOptions: { description: `Pay $${amountUsd} USDC on Base` } },
        );
        hash = sent.hash;
      } else {
        let fee: number = POOL_FEES[0];
        let quotedIn = 0n;
        let quoteErr: unknown = null;
        for (const f of POOL_FEES) {
          try {
            const q = (await publicClient.readContract({
              address: QUOTER_V2,
              abi: quoterAbi,
              functionName: "quoteExactOutputSingle",
              args: [
                {
                  tokenIn: WETH,
                  tokenOut: USDC,
                  amount,
                  fee: f,
                  sqrtPriceLimitX96: 0n,
                },
              ],
            })) as readonly [bigint, bigint, number, bigint] | bigint;
            quotedIn = Array.isArray(q) ? q[0] : q;
            fee = f;
            quoteErr = null;
            break;
          } catch (e) {
            quoteErr = e;
          }
        }
        if (!quotedIn) {
          throw quoteErr instanceof Error ? quoteErr : new Error("Uniswap quote failed on Base.");
        }
        const maxIn = (quotedIn * 105n) / 100n;
        const sent = await sendTransaction(
          {
            to: SWAP_ROUTER02,
            data: encodeEthToUsdcSwap(treasury, amount, maxIn, fee),
            value: maxIn,
            chainId: base.id,
          },
          {
            uiOptions: {
              description: `Swap ETH → $${amountUsd} USDC on Uniswap, send to treasury`,
            },
          },
        );
        hash = sent.hash;
      }
      await publicClient.waitForTransactionReceipt({ hash });
      onSuccess(hash);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setBusy(false);
    }
  }

  const label = kind === "pitch" ? `Pitch · $${amountUsd}` : `Steal · $${amountUsd}`;

  if (!ready) {
    return <p className="text-sm text-muted">Wallet layer loading…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-display text-2xl">{label}</p>
      <p className="text-sm text-muted">
        USDC on Base. If you only have ETH, Uniswap swaps the exact amount and sends it to the treasury. The
        URL never moves.
      </p>
      {!authenticated ? (
        <Button size="lg" onClick={() => login()}>
          Sign in to pay
        </Button>
      ) : (
        <Button size="lg" onClick={() => void pay()} disabled={busy || !treasury}>
          {busy ? "Paying…" : `Pay $${amountUsd} USDC`}
        </Button>
      )}
      <Button variant="ghost" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
      {err ? <p className="text-sm text-stamp">{err}</p> : null}
    </div>
  );
}

export default LivePay;
