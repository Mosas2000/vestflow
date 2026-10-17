"use client";

import { ReactNode, useState } from "react";
import Navbar from "@/components/Navbar";
import { useToast } from "@/components/Toast";
import { useWallet } from "@/lib/WalletContext";
import { connectWallet } from "@/lib/stellar";

export default function AppWalletGate({ children }: { children: ReactNode }) {
  const { publicKey, setPublicKey, walletReady = true } = useWallet();
  const { addToast } = useToast();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const address = await connectWallet();
      setPublicKey(address);
    } catch (error) {
      addToast({
        status: "error",
        title: "Connection failed",
        message: error instanceof Error ? error.message : "Could not connect wallet",
        duration: 4000,
      });
    } finally {
      setConnecting(false);
    }
  };

  if (!walletReady) {
    return (
      <>
        <Navbar />
        <main className="flex min-h-screen items-center justify-center px-6 pt-24">
          <p className="text-sm text-zinc-500">Checking wallet…</p>
        </main>
      </>
    );
  }

  if (!publicKey) {
    return (
      <>
        <Navbar />
        <main className="flex min-h-screen items-center justify-center px-6 pt-24 pb-16">
          <div className="card w-full max-w-md p-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/10 border border-violet-500/20">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-violet-400"
                aria-hidden="true"
              >
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M16 12h.01" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">Connect your wallet to continue</h1>
            <p className="mt-2 text-sm text-zinc-400">
              You need a connected Stellar wallet to access this page.
            </p>
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="btn-primary mt-6 w-full rounded-xl py-3 font-semibold text-white disabled:opacity-60"
            >
              {connecting ? "Connecting…" : "Connect Wallet"}
            </button>
          </div>
        </main>
      </>
    );
  }

  return <>{children}</>;
}
