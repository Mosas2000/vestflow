import AppWalletGate from "@/components/AppWalletGate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppWalletGate>{children}</AppWalletGate>;
}
