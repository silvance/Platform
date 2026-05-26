"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import type { PublicUser } from "@ci-train/contracts";
import type { Theme } from "@/lib/theme";
import { LogoutButton } from "./logout-button";
import { ThemeToggle } from "./theme-toggle";

interface Props {
  user: PublicUser;
  theme: Theme;
 // count of self-registered accounts awaiting admin
  // approval. Passed from the server layout. Always 0 for
  // non-admin users (the layout doesn't fetch it).
  pendingApprovalCount: number;
}

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  admin?: boolean;
  external?: boolean;
}> = [
  { href: "/scenarios", label: "Challenges" },
  { href: "/me/progress", label: "Progress" },
  { href: "/me/security", label: "Security" },
  // External reference site. Opens in a new tab.
  { href: "https://codeworld.codes", label: "Reference", external: true },
  { href: "/admin", label: "Admin", admin: true },
 // surface Review directly in the nav. Buried as a tile
  // on /admin in M21b — feedback was that operators couldn't
  // find it. A top-level link makes the playthrough surface
  // unmissable.
  { href: "/admin/review", label: "Review", admin: true },
 // per-scenario / per-question analytics.
  { href: "/admin/analytics", label: "Analytics", admin: true },
 // recent-completions feed: who finished what, when.
  { href: "/admin/completions", label: "Completions", admin: true },
 // registration access-code management surface.
  { href: "/admin/access-codes", label: "Codes", admin: true },
 // user-submitted feedback inbox.
  { href: "/admin/feedback", label: "Feedback", admin: true },
];

export function AppHeader({ user, theme, pendingApprovalCount }: Props) {
  const pathname = usePathname() ?? "";
  const initials = initialsFor(user.displayName, user.email);

  const visibleNav = NAV_ITEMS.filter(
    (n) => !n.admin || user.role === "admin",
  );

  // Mobile drawer state. Toggled by the hamburger button below the
  // 768px breakpoint; CSS hides the drawer entirely on wider screens.
  const [menuOpen, setMenuOpen] = useState(false);

  // Auto-close the drawer whenever the route changes (the user just
  // tapped a nav link — no reason to keep the overlay open).
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // ESC closes the drawer too.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Lock background scroll while the drawer is open so a tap-through
  // doesn't scroll the page underneath. Cleaned up on close.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = menuOpen ? "hidden" : prev;
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <header className="app-header" data-menu-open={menuOpen ? "true" : "false"}>
      <div className="app-header-inner">
        <Link
          href={user.role === "admin" ? "/admin" : "/scenarios"}
          className="brand"
        >
          CI Cyber Lab
        </Link>
        <nav className="nav-links" id="primary-nav" aria-label="Primary">
          {visibleNav.map((item, idx) => {
            // The Admin nav link gets a pending-approval badge
            // when self-registrations are waiting. /admin/users
            // is where the admin acts on them.
            const showPendingBadge =
              item.href === "/admin" && pendingApprovalCount > 0;
            // Drop a thin divider in front of the first admin-only
            // link to visually separate learner vs operator nav.
            const showDivider =
              item.admin && idx > 0 && !visibleNav[idx - 1]?.admin;
            // External links bypass next/link and just render an
            // <a target="_blank"> with a trailing arrow glyph.
            if (item.external) {
              return (
                <Fragment key={item.href}>
                  {showDivider ? <span className="nav-divider" aria-hidden /> : null}
                  <a
                    href={item.href}
                    className="nav-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.label}
                    <span aria-hidden style={{ fontSize: ".75em", opacity: 0.7 }}>
                      ↗
                    </span>
                  </a>
                </Fragment>
              );
            }
            return (
              <Fragment key={item.href}>
                {showDivider ? <span className="nav-divider" aria-hidden /> : null}
                <Link
                  href={showPendingBadge ? "/admin/users" : item.href}
                  className="nav-link"
                  data-active={isActive(pathname, item.href, visibleNav)}
                  title={
                    showPendingBadge
                      ? `${pendingApprovalCount} self-registration${
                          pendingApprovalCount === 1 ? "" : "s"
                        } awaiting approval`
                      : undefined
                  }
                >
                  {item.label}
                  {showPendingBadge ? (
                    <span
                      aria-label={`${pendingApprovalCount} pending`}
                      className="nav-pending-badge"
                    >
                      {pendingApprovalCount}
                    </span>
                  ) : null}
                </Link>
              </Fragment>
            );
          })}
        </nav>
        <div className="header-actions">
          <ThemeToggle current={theme} />
          <span className="user-chip" title={user.email}>
            <span className="avatar" aria-hidden>{initials}</span>
            <span className="user-chip-name">{user.displayName}</span>
            {user.role === "admin" ? (
              <span className="role-badge">admin</span>
            ) : null}
          </span>
          <LogoutButton />
        </div>
        <button
          type="button"
          className="nav-burger"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="primary-nav"
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          ) : (
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}

// Active when the pathname matches the href exactly OR when the
// pathname sits under the link's section. The /admin link should
// stay highlighted on /admin/challenges, /admin/users, etc.
// /scenarios should highlight on /scenarios/<slug>.
//
// `siblings` lets a link defer to a more-specific sibling: visiting
// /admin/review should highlight the Review link, NOT also light up
// the parent /admin link. The rule: a link is NOT active if some
// other nav link is a strictly deeper match for the same pathname.
function isActive(
  pathname: string,
  href: string,
  siblings: Array<{ href: string }>,
): boolean {
  if (pathname === href) return true;
  if (href === "/") return false;
  if (!pathname.startsWith(href + "/") && pathname !== href) return false;
  for (const s of siblings) {
    if (s.href === href) continue;
    if (s.href.startsWith(href + "/")) {
      if (pathname === s.href || pathname.startsWith(s.href + "/")) {
        return false;
      }
    }
  }
  return pathname.startsWith(href + "/");
}

function initialsFor(displayName: string, email: string): string {
  const name = displayName?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    const a = parts[0]?.[0] ?? "";
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
    return (a + b).slice(0, 2).toUpperCase() || "?";
  }
  return (email[0] ?? "?").toUpperCase();
}
