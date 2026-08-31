import { getSql } from "@/lib/db";
import { USDC, USDC_TRANSFER_TOPIC, usdcUnits, BASE_RPC } from "./base";
import { getTreasury, payConfigured } from "./config";

type RpcReceipt = {
  status?: string;
  logs?: { address?: string; topics?: string[]; data?: string }[];
};

async function baseRpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(BASE_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error("Base RPC error");
  const body = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message || "Base RPC error");
  return body.result ?? null;
}

function padAddress(addr: string): string {
  return `0x${addr.slice(2).toLowerCase().padStart(64, "0")}`;
}

export async function confirmPayment(input: {
  fingerprint: string;
  txHash?: string | null;
  amountUsd: number;
  kind: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!payConfigured()) return { ok: true };
  const treasury = getTreasury();
  if (!treasury) return { ok: false, error: "Treasury is not configured." };
  const hash = input.txHash?.trim().toLowerCase();
  if (!hash || !/^0x[a-f0-9]{64}$/.test(hash)) {
    return { ok: false, error: "Pay $USDC on Base first." };
  }
  const sql = await getSql();
  const used = await sql`select tx_hash from payments where tx_hash = ${hash}`;
  if (used[0]) return { ok: false, error: "That payment was already used." };
  let receipt: RpcReceipt | null = null;
  try {
    receipt = (await baseRpc("eth_getTransactionReceipt", [hash])) as RpcReceipt | null;
  } catch {
    return { ok: false, error: "Could not read Base. Try again in a few seconds." };
  }
  if (!receipt) return { ok: false, error: "Payment is still confirming on Base." };
  if (receipt.status !== "0x1") return { ok: false, error: "That transaction failed." };
  const need = usdcUnits(input.amountUsd);
  const toTopic = padAddress(treasury);
  const got = (receipt.logs ?? []).some((log) => {
    if ((log.address || "").toLowerCase() !== USDC.toLowerCase()) return false;
    const topics = log.topics ?? [];
    if ((topics[0] || "").toLowerCase() !== USDC_TRANSFER_TOPIC) return false;
    if ((topics[2] || "").toLowerCase() !== toTopic) return false;
    const value = BigInt(log.data || "0x0");
    return value >= need;
  });
  if (!got) {
    return { ok: false, error: `No USDC transfer of $${input.amountUsd} to the treasury in that tx.` };
  }
  const cents = Math.round(input.amountUsd * 100);
  await sql`
    insert into payments (tx_hash, fingerprint, kind, amount_cents)
    values (${hash}, ${input.fingerprint}, ${input.kind}, ${cents})
  `;
  return { ok: true };
}
