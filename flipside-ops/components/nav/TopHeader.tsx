"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Settings, LogOut, User, Search } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { signOut } from "@/app/(auth)/login/actions";
import {
  isAdmin,
  LEVEL_LABELS,
  type SessionProfile,
} from "@/lib/access";
import { NotificationsPopover } from "@/components/NotificationsPopover";
import { CommandPalette } from "@/components/CommandPalette";

export function TopHeader({ profile }: { profile: SessionProfile }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 bg-surface-strong border-b border-border-soft">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-4">
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

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 h-9 rounded-lg border border-border-soft bg-canvas text-muted hover:text-ink hover:border-brand-300 transition-colors"
            aria-label="Search"
          >
            <Search size={16} />
            <span className="hidden md:inline text-sm">Search</span>
            <kbd className="hidden md:inline text-[10px] font-medium text-muted bg-surface border border-border-soft rounded px-1 py-0.5">
              ⌘K
            </kbd>
          </button>

          <NotificationsPopover />

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 p-1 rounded-full hover:bg-canvas"
              aria-label="Account menu"
            >
              <Avatar
                name={profile.full_name}
                src={profile.avatar_url}
                size={32}
              />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-surface border border-border-soft rounded-[var(--radius-card)] shadow-[var(--shadow-elevated)] overflow-hidden z-30">
                <div className="px-4 py-3 border-b border-border-soft">
                  <div className="text-sm font-medium truncate">
                    {profile.full_name ?? profile.email}
                  </div>
                  <div className="text-xs text-muted truncate">
                    {profile.email}
                  </div>
                  <div className="text-xs text-brand-700 mt-1">
                    Level {profile.access_level} · {LEVEL_LABELS[profile.access_level]}
                  </div>
                </div>
                <Link
                  href="/me"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-canvas"
                >
                  <User size={14} /> My profile
                </Link>
                {isAdmin(profile) && (
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
      </header>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
