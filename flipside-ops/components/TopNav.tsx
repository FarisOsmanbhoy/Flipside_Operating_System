"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Settings, LogOut, User } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/format";
import { signOut } from "@/app/(auth)/login/actions";
import type { SessionProfile } from "@/lib/auth";
import { UniversalSearch } from "@/components/UniversalSearch";
import { NotificationsPopover } from "@/components/NotificationsPopover";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/staff", label: "Staff" },
  { href: "/clients", label: "Clients" },
  { href: "/tasks", label: "Tasks" },
];

export function TopNav({ profile }: { profile: SessionProfile }) {
  const path = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 bg-surface border-b border-border-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src="/brand/logo.jpg"
            alt="FlipSide"
            width={32}
            height={32}
            className="rounded"
          />
          <span className="hidden sm:inline font-display font-semibold text-brand-700">
            FlipSide Ops
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {TABS.map((tab) => {
            const active =
              tab.href === "/"
                ? path === "/"
                : path === tab.href || path.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-lg transition-colors",
                  active
                    ? "bg-brand-50 text-brand-700 font-medium"
                    : "text-muted hover:text-ink hover:bg-canvas",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1 flex justify-center">
          <UniversalSearch />
        </div>

        <div className="flex items-center gap-2">
          <NotificationsPopover />

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 p-1 rounded-full hover:bg-canvas"
              aria-label="Account menu"
            >
              <Avatar name={profile.full_name} src={profile.avatar_url} size={32} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-surface border border-border-soft rounded-[var(--radius-card)] shadow-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border-soft">
                  <div className="text-sm font-medium truncate">
                    {profile.full_name ?? profile.email}
                  </div>
                  <div className="text-xs text-muted truncate">{profile.email}</div>
                  <div className="text-xs text-brand-700 mt-1 capitalize">
                    {profile.role}
                  </div>
                </div>
                <Link
                  href="/me"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-canvas"
                >
                  <User size={14} /> My profile
                </Link>
                {profile.role === "admin" && (
                  <Link
                    href="/admin/users"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-canvas"
                  >
                    <Settings size={14} /> Admin
                  </Link>
                )}
                <form action={signOut}>
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger-700 hover:bg-danger-50"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
