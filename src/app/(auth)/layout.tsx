import Link from "next/link";
import { Wallet } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-6">
      <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Wallet className="size-4" />
        </span>
        Finanças+
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
