import type { ReactNode } from "react";
import { requireUser } from "@/lib/session";
import { readTheme } from "@/lib/theme";
import { AppHeader } from "./app-header";

// Authenticated shell. Header is its own client-aware component
// so the per-route active-state highlight can use usePathname
// without dragging the whole layout into the client bundle.
export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const theme = await readTheme();

  return (
    <>
      <AppHeader user={user} theme={theme} />
      {children}
    </>
  );
}
