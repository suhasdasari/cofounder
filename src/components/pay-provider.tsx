import { createContext, useContext, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { base } from "viem/chains";
import { getPrivyAppId } from "@/lib/pay/config";

const PayReadyCtx = createContext(false);

export function usePayReady(): boolean {
  return useContext(PayReadyCtx);
}

type PrivyProv = ComponentType<{
  appId: string;
  config?: Record<string, unknown>;
  children?: ReactNode;
}>;

export function PayProvider({ children }: { children: ReactNode }) {
  const appId = getPrivyAppId();
  const [Prov, setProv] = useState<PrivyProv | null>(null);

  useEffect(() => {
    if (!appId) return;
    let alive = true;
    void import("@privy-io/react-auth").then((m) => {
      if (alive) setProv(() => m.PrivyProvider as unknown as PrivyProv);
    });
    return () => {
      alive = false;
    };
  }, [appId]);

  if (!appId || !Prov) {
    return <PayReadyCtx.Provider value={false}>{children}</PayReadyCtx.Provider>;
  }

  return (
    <Prov
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#F2271D",
          logo: "/favicon.svg",
        },
        defaultChain: base,
        supportedChains: [base],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
        loginMethods: ["email", "wallet", "google"],
      }}
    >
      <PayReadyCtx.Provider value={true}>{children}</PayReadyCtx.Provider>
    </Prov>
  );
}
