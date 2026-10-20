"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSavedRecipes } from "@/lib/storage";
import { Icon } from "./Icon";

const NAV = [
  { href: "/", label: "Spin" },
  { href: "/cook/", label: "Cook with what I have" },
  { href: "/saved/", label: "Saved" },
  { href: "/about/", label: "About the data" },
];

function isActive(pathname: string, href: string) {
  const clean = (p: string) => p.replace(/\/+$/, "") || "/";
  // usePathname() excludes the basePath, so a direct comparison works.
  return clean(pathname) === clean(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { saved } = useSavedRecipes();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-[2px]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-full pr-2" aria-label="Mr. Cook home">
          <Logo />
          <span className="font-display text-xl font-semibold tracking-tight">Mr. Cook</span>
        </Link>

        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-[0.9375rem] font-medium text-muted hover:text-ink aria-[current=page]:bg-surface-2 aria-[current=page]:text-ink"
                >
                  {item.label}
                  {item.href === "/saved/" && saved.length > 0 && (
                    <span className="rounded-full bg-accent px-1.5 text-xs font-bold text-on-accent" aria-label={`${saved.length} saved`}>
                      {saved.length}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <button
          ref={buttonRef}
          type="button"
          className="btn btn-ghost md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name={open ? "close" : "menu"} />
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Main" className="border-t border-line bg-bg md:hidden">
          <ul className="mx-auto flex max-w-6xl flex-col px-4 py-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center justify-between border-b border-line text-base font-medium last:border-0 aria-[current=page]:text-accent"
                >
                  {item.label}
                  {item.href === "/saved/" && saved.length > 0 && <span className="text-sm text-muted">{saved.length}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}

export function Logo({ size = 34 }: { size?: number }) {
  // A plate seen from above with a wedge marked: the wheel, simplified.
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle cx="20" cy="20" r="18" fill="var(--accent)" />
      <circle cx="20" cy="20" r="12.5" fill="var(--bg)" />
      <path d="M20 20 L20 7.5 A12.5 12.5 0 0 1 30.8 13.75 Z" fill="var(--saffron)" />
      <circle cx="20" cy="20" r="3" fill="var(--ink)" />
    </svg>
  );
}
