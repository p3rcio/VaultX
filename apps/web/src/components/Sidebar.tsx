"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

function IconGrid() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}
function IconShare() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}
function IconInbox() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  );
}
function IconAudit() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}
function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}
function IconX() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

const navItems = [
  { href: "/dashboard",     label: "Dashboard",      icon: <IconGrid /> },
  { href: "/shared",        label: "My Shares",       icon: <IconShare /> },
  { href: "/shared-with-me",label: "Shared With Me",  icon: <IconInbox /> },
  { href: "/audit",         label: "Audit Log",       icon: <IconAudit /> },
  { href: "/settings",      label: "Settings",        icon: <IconSettings /> },
];

function Logo() {
  return (
    <>
      <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center text-white flex-shrink-0">
        <IconLock />
      </div>
      <span className="text-base font-bold text-on-surface tracking-tight">
        Vault<span className="text-accent">X</span>
      </span>
    </>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const drawer = drawerRef.current;
    if (!drawer) return;

    const closeBtn = drawer.querySelector<HTMLElement>("button[aria-label=\"Close navigation menu\"]");
    closeBtn?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = drawer!.querySelectorAll<HTMLElement>(
        "a, button, input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const navLinks = (
    <nav className="flex-1 px-3 space-y-1" aria-label="Site navigation">
      {navItems.map(({ href, label, icon }) => {
        const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors relative group
              ${isActive
                ? "bg-accent/15 text-accent"
                : "text-on-surface-muted hover:text-on-surface hover:bg-surface-high"
              }
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary`}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-accent rounded-r-full" aria-hidden="true" />
            )}
            <span className={isActive ? "text-accent" : "text-on-surface-muted group-hover:text-on-surface"}>
              {icon}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const userSection = (
    <div className="px-3 py-4 border-t border-white/5">
      <Link
        href="/account"
        className="flex items-center gap-3 px-3 py-2 mb-1 rounded-md hover:bg-surface-high transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="My account"
      >
        <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0" aria-hidden="true">
          {user?.email?.[0]?.toUpperCase() ?? "?"}
        </div>
        <span className="text-xs text-on-surface-muted truncate flex-1">{user?.email}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-on-surface-muted/50 flex-shrink-0" aria-hidden="true">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </Link>
      <button
        onClick={() => { if (confirm("Are you sure you want to log out?")) logout(); }}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm text-on-surface-muted hover:text-error hover:bg-error/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
        aria-label="Log out"
      >
        <IconLogout />
        Log out
      </button>
    </div>
  );

  return (
    <>
      <div className="fixed top-0 left-0 right-0 h-14 bg-primary border-b border-white/5 z-40 flex items-center justify-between px-4 lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md px-1" aria-label="Go to dashboard">
          <Logo />
        </Link>
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 rounded-md text-on-surface-muted hover:text-on-surface hover:bg-surface-high transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Open navigation menu"
          aria-expanded={isOpen}
          aria-controls="mobile-drawer"
        >
          <IconMenu />
        </button>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        ref={drawerRef}
        id="mobile-drawer"
        className={`sidebar bg-primary flex flex-col border-r border-white/5 z-50${isOpen ? " sidebar-open" : ""}`}
        aria-label="Main navigation"
      >

        <div className="flex items-center justify-between px-4 h-14 border-b border-white/5 lg:hidden flex-shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md px-1" aria-label="Go to dashboard">
            <Logo />
          </Link>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-md text-on-surface-muted hover:text-on-surface hover:bg-surface-high transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Close navigation menu"
          >
            <IconX />
          </button>
        </div>

        <Link
          href="/dashboard"
          className="hidden lg:flex px-5 py-6 items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-md"
          aria-label="Go to dashboard"
        >
          <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center text-white">
            <IconLock />
          </div>
          <span className="text-lg font-bold text-on-surface tracking-tight">
            Vault<span className="text-accent">X</span>
          </span>
        </Link>

        {navLinks}
        {userSection}
      </aside>
    </>
  );
}
