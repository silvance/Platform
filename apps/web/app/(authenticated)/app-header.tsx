"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";
import type { PublicUser } from "@ci-train/contracts";
import type { Theme } from "@/lib/theme";
import { LogoutButton } from "./logout-button";
import { ThemeToggle } from "./theme-toggle";

interface Props {
  user: PublicUser;
  theme: Theme;
  pendingApprovalCount: number;
}

// Top-level nav. Admin sub-pages live in ADMIN_SUB_LINKS below and
// hang off the "Admin" link as a dropdown so the bar doesn't blow
// up to ~10 items.
const NAV_ITEMS: Array<{
  href: string;
  label: string;
  admin?: boolean;
  external?: boolean;
}> = [
  { href: "/scenarios", label: "Challenges" },
  { href: "/me/progress", label: "Progress" },
  { href: "/me/security", label: "Security" },
  { href: "https://codeworld.codes", label: "Reference", external: true },
  { href: "/admin", label: "Admin", admin: true },
];

// Admin sub-pages — shown in a dropdown off "Admin" on desktop and
// as flat rows under "Admin" inside the mobile drawer.
const ADMIN_SUB_LINKS: Array<{ href: string; label: string }> = [
  { href: "/admin/review", label: "Review" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/completions", label: "Completions" },
  { href: "/admin/access-codes", label: "Codes" },
  { href: "/admin/feedback", label: "Feedback" },
];

export function AppHeader({ user, theme, pendingApprovalCount }: Props) {
  const pathname = usePathname() ?? "";
  const initials = initialsFor(user.displayName, user.email);

  const visibleNav = NAV_ITEMS.filter(
    (n) => !n.admin || user.role === "admin",
  );

  const [menuOpen, setMenuOpen] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const adminDropdownRef = useRef<HTMLDivElement | null>(null);

  // Auto-close both menus on route change.
  useEffect(() => {
    setMenuOpen(false);
    setAdminMenuOpen(false);
  }, [pathname]);

  // ESC closes the drawer.
  useEffect(() => {
    if (!menuOpen && !adminMenuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setAdminMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, adminMenuOpen]);

  // Click outside closes the admin dropdown. The mobile drawer is
  // an overlay that already covers the page so it doesn't need this.
  useEffect(() => {
    if (!adminMenuOpen) return;
    function onDown(e: MouseEvent) {
      if (!adminDropdownRef.current) return;
      if (!adminDropdownRef.current.contains(e.target as Node)) {
        setAdminMenuOpen(false);
      }
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [adminMenuOpen]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = menuOpen ? "hidden" : prev;
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const isAdmin = user.role === "admin";
  const adminActive =
    pathname === "/admin" || pathname.startsWith("/admin/");

  return (
    <header className="app-header" data-menu-open={menuOpen ? "true" : "false"}>
      <div className="app-header-inner">
        <Link
          href={isAdmin ? "/admin" : "/scenarios"}
          className="brand"
        >
          <span className="brand-mark" aria-hidden />
          CI Cyber Lab
        </Link>
        <nav className="nav-links" id="primary-nav" aria-label="Primary">
          {visibleNav.map((item, idx) => {
            const showPendingBadge =
              item.href === "/admin" && pendingApprovalCount > 0;
            const showDivider =
              item.admin && idx > 0 && !visibleNav[idx - 1]?.admin;

            // External links: <a target="_blank"> with trailing arrow.
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

            // Admin link gets a dropdown trigger + sub-link popover.
            if (item.href === "/admin" && isAdmin) {
              return (
                <Fragment key={item.href}>
                  {showDivider ? <span className="nav-divider" aria-hidden /> : null}
                  <div
                    className="admin-dropdown"
                    ref={adminDropdownRef}
                    data-open={adminMenuOpen ? "true" : "false"}
                  >
                    <Link
                      href={showPendingBadge ? "/admin/users" : "/admin"}
                      className="nav-link"
                      data-active={adminActive}
                      title={
                        showPendingBadge
                          ? `${pendingApprovalCount} self-registration${
                              pendingApprovalCount === 1 ? "" : "s"
                            } awaiting approval`
                          : undefined
                      }
                    >
                      Admin
                      {showPendingBadge ? (
                        <span
                          aria-label={`${pendingApprovalCount} pending`}
                          className="nav-pending-badge"
                        >
                          {pendingApprovalCount}
                        </span>
                      ) : null}
                    </Link>
                    <button
                      type="button"
                      className="admin-dropdown-toggle"
                      aria-haspopup="menu"
                      aria-expanded={adminMenuOpen}
                      aria-label={adminMenuOpen ? "Close admin menu" : "Open admin menu"}
                      onClick={() => setAdminMenuOpen((v) => !v)}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {adminMenuOpen ? (
                      <div className="admin-dropdown-menu" role="menu">
                        {ADMIN_SUB_LINKS.map((sub) => (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            className="admin-dropdown-item"
                            role="menuitem"
                            data-active={pathname === sub.href || pathname.startsWith(sub.href + "/")}
                          >
                            {sub.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </Fragment>
              );
            }

            return (
              <Fragment key={item.href}>
                {showDivider ? <span className="nav-divider" aria-hidden /> : null}
                <Link
                  href={item.href}
                  className="nav-link"
                  data-active={isActive(pathname, item.href, visibleNav)}
                >
                  {item.label}
                </Link>
              </Fragment>
            );
          })}
          {/* Mobile drawer also surfaces the admin sub-links as
              flat rows (one per link). On desktop these are hidden
              by CSS — the dropdown is the only way in. */}
          {isAdmin
            ? ADMIN_SUB_LINKS.map((sub) => (
                <Link
                  key={`mobile-${sub.href}`}
                  href={sub.href}
                  className="nav-link nav-link-mobile-only"
                  data-active={pathname === sub.href || pathname.startsWith(sub.href + "/")}
                >
                  {sub.label}
                </Link>
              ))
            : null}
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

// Active when the pathname matches the href exactly OR sits under
// the link's section. A link defers to a deeper sibling — so
// /admin/review highlights "Review", not also "Admin."
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
