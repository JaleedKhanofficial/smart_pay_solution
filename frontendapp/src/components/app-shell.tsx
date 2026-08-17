"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { logoutAction } from "@/app/login/actions";
import type { NavSection } from "@/lib/navigation";
import type { SessionUser } from "@/types/customer";

type Props = {
    sections: NavSection[];
    user: SessionUser;
    children: ReactNode;
};

function initials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}

export function AppShell({ sections, user, children }: Props) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);

    const isActive = (href: string) =>
        pathname === href || pathname.startsWith(`${href}/`);

    const nav = (
        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
            {sections.map((section) => (
                <div key={section.title}>
                    <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                        {section.title}
                    </p>
                    <ul className="flex flex-col gap-0.5">
                        {section.items.map((item) => {
                            const active = isActive(item.href);

                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        onClick={() => setMobileOpen(false)}
                                        aria-current={
                                            active ? "page" : undefined
                                        }
                                        className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                                            active
                                                ? "bg-white/10 font-medium text-white"
                                                : "text-white/65 hover:bg-white/5 hover:text-white"
                                        }`}
                                    >
                                        {active ? (
                                            <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-gold" />
                                        ) : null}
                                        <Icon
                                            name={item.icon}
                                            className={`size-4 shrink-0 ${
                                                active
                                                    ? "text-gold"
                                                    : "text-white/45 group-hover:text-white/70"
                                            }`}
                                        />
                                        <span className="truncate">
                                            {item.label}
                                        </span>
                                        {!item.built ? (
                                            <span
                                                title="Not built yet"
                                                className="ml-auto size-1.5 shrink-0 rounded-full bg-white/25"
                                            />
                                        ) : null}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>
    );

    const brand = (
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
            <span className="grid size-8 place-items-center rounded-md bg-gold text-sm font-bold text-navy-900">
                S
            </span>
            <span className="leading-tight">
                <span className="block text-sm font-semibold text-white">
                    SmartPay
                </span>
                <span className="block text-[10px] uppercase tracking-[0.14em] text-gold-soft">
                    Solutions
                </span>
            </span>
        </div>
    );

    const account = (
        <div className="shrink-0 border-t border-white/10 p-3">
            <div className="flex items-center gap-3 rounded-md px-2 py-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-white">
                    {initials(user.name)}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm text-white">
                        {user.name}
                    </span>
                    <span className="block truncate text-[11px] uppercase tracking-wide text-gold-soft">
                        {user.role}
                    </span>
                </span>
                <form action={logoutAction}>
                    <button
                        type="submit"
                        title="Sign out"
                        aria-label="Sign out"
                        className="grid size-8 place-items-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                    >
                        <Icon name="logout" className="size-4" />
                    </button>
                </form>
            </div>
        </div>
    );

    return (
        <div className="flex min-h-dvh bg-background">
            {/* Desktop sidebar */}
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-navy-900 lg:flex">
                {brand}
                {nav}
                {account}
            </aside>

            {/* Mobile drawer */}
            {mobileOpen ? (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <button
                        type="button"
                        aria-label="Close navigation"
                        onClick={() => setMobileOpen(false)}
                        className="absolute inset-0 bg-black/50"
                    />
                    <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-navy-900">
                        {brand}
                        {nav}
                        {account}
                    </aside>
                </div>
            ) : null}

            <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
                <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface/85 px-4 backdrop-blur sm:px-6">
                    <button
                        type="button"
                        onClick={() => setMobileOpen(true)}
                        aria-label="Open navigation"
                        className="grid size-9 place-items-center rounded-md border border-border text-muted transition-colors hover:text-foreground lg:hidden"
                    >
                        <Icon name="menu" className="size-4" />
                    </button>

                    <span className="text-sm text-muted">
                        Installment Sales &amp; Recovery Management
                    </span>

                    <span className="ml-auto hidden text-xs text-muted sm:block">
                        {user.email}
                    </span>
                </header>

                <main className="min-w-0 flex-1">{children}</main>
            </div>
        </div>
    );
}
