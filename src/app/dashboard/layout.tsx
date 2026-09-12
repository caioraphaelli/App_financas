import Link from "next/link";
import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NavLinks } from "@/components/dashboard/nav-links";
import { UserMenu } from "@/components/dashboard/user-menu";
import { MobileNav } from "@/components/dashboard/mobile-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="grid min-h-svh md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r bg-sidebar md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Wallet className="size-4" />
          </span>
          Finanças+
        </div>
        <div className="flex-1 py-4">
          <NavLinks />
        </div>
        <div className="border-t p-2">
          <UserMenu email={user?.email ?? ""} />
        </div>
      </aside>

      <div className="flex flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
          <MobileNav />
          <Link href="/dashboard" className="font-semibold md:hidden">
            Finanças+
          </Link>
          <div className="ml-auto md:hidden">
            <UserMenu email={user?.email ?? ""} />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
