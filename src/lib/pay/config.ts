/** USDC amounts in dollars. Onchain units are 6 decimals. */
export const PRICE = {
  pitchUsd: 5,
  stealFreeRowUsd: 0.5,
  stealVerifiedUsd: 1,
} as const;

function readEnv(name: "VITE_PRIVY_APP_ID" | "VITE_TREASURY_ADDRESS"): string {
  const fromProc =
    typeof process !== "undefined" ? process.env[name] : undefined;
  const fromVite =
    typeof import.meta !== "undefined"
      ? (import.meta.env as Record<string, string | undefined>)[name]
      : undefined;
  return String(fromProc || fromVite || "").trim();
}

export function getPrivyAppId(): string | null {
  const id = readEnv("VITE_PRIVY_APP_ID");
  return id.length > 8 ? id : null;
}

export function getTreasury(): `0x${string}` | null {
  const a = readEnv("VITE_TREASURY_ADDRESS");
  return /^0x[a-fA-F0-9]{40}$/.test(a) ? (a as `0x${string}`) : null;
}

export function payConfigured(): boolean {
  return Boolean(getPrivyAppId() && getTreasury());
}

export function clientPayConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_PRIVY_APP_ID && import.meta.env.VITE_TREASURY_ADDRESS,
  );
}
