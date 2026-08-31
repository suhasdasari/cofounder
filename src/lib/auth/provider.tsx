import type { ReactNode } from "react";
import { PayProvider } from "@/components/pay-provider";

/**
 * App-wide client provider mounted once near the top of the document shell.
 * Better Auth needs no React context; PayProvider mounts Privy only when a
 * Privy app ID is present so the roast loop never depends on wallet keys.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  return <PayProvider>{children}</PayProvider>;
}
