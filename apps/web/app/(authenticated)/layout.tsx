import type { ReactNode } from "react";
import { readToken, requireUser } from "@/lib/session";
import { readTheme } from "@/lib/theme";
import { api, ApiError } from "@/lib/api";
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

 // pre-fetch the pending-approval count for admins so the
  // header badge has it on the initial server render. Cheap query
  // (single indexed-int read); failures are non-fatal — the
  // header just renders without the badge if the stats endpoint
  // is down.
  let pendingApprovalCount = 0;
  if (user.role === "admin") {
    const token = await readToken();
    if (token) {
      try {
        const stats = await api.stats.get(token);
        pendingApprovalCount = stats.users.pendingApproval;
      } catch (err) {
        // Stats endpoint failure shouldn't break the whole shell.
        // Log only — leave the badge off.
        if (!(err instanceof ApiError)) {
          // eslint-disable-next-line no-console
          console.error("layout: stats fetch failed", err);
        }
      }
    }
  }

  return (
    <>
      <AppHeader
        user={user}
        theme={theme}
        pendingApprovalCount={pendingApprovalCount}
      />
      {children}
    </>
  );
}
