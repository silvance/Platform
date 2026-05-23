"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PublicUser } from "@ci-train/contracts";
import type { Theme } from "@/lib/theme";
import { LogoutButton } from "./logout-button";
import { ThemeToggle } from "./theme-toggle";

interface Props {
  user: PublicUser;
  theme: Theme;
}

const NAV_ITEMS: Array<{ href: string; label: string; admin?: boolean }> = [
  { href: "/scenarios", label: "Challenges" },
  { href: "/me/progress", label: "Progress" },
  { href: "/me/security", label: "Security" },
  { href: "/admin", label: "Admin", admin: true },
];

export function AppHeader({ user, theme }: Props) {
  const pathname = usePathname() ?? "";
  const initials = initialsFor(user.displayName, user.email);

  const visibleNav = NAV_ITEMS.filter(
    (n) => !n.admin || user.role === "admin",
  );

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <Link
          href={user.role === "admin" ? "/admin" : "/scenarios"}
          className="brand"
        >
          <span className="brand-mark" aria-hidden>CL</span>
          CICyberLab
        </Link>
        <nav className="nav-links" aria-label="Primary">
          {visibleNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="nav-link"
              data-active={isActive(pathname, item.href)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <ThemeToggle current={theme} />
          <span className="user-chip" title={user.email}>
            <span className="avatar" aria-hidden>{initials}</span>
            {user.displayName}
            {user.role === "admin" ? (
              <span className="role-badge">admin</span>
            ) : null}
          </span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}

// Active when the pathname matches the href exactly OR when the
// pathname sits under the link's section. The /admin link should
// stay highlighted on /admin/challenges, /admin/users, etc.
// /scenarios should highlight on /scenarios/<slug>.
function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/") return false;
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
