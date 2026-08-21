"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { ThemeModeToggle } from "./theme-mode-toggle";
import { logoutAction } from "@/app/login/actions";
import type { NavSection } from "@/lib/navigation";
import { SIDEBAR_COOKIE } from "@/lib/sidebar";
import type { ThemeMode } from "@/lib/theme-mode";
import type { SessionUser } from "@/types/customer";

type Props = {
    sections: NavSection[];
    user: SessionUser;
    /** Read from the cookie on the server so the rail renders at the right
     *  width immediately — a localStorage read would flash open then collapse. */
    defaultCollapsed: boolean;
    themeMode: ThemeMode;
    children: ReactNode;
};

function initials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("");
}

export function AppShell({
    sections,
    user,
    defaultCollapsed,
    themeMode,
    children,
}: Props) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(defaultCollapsed);

    const isActive = (href: string) =>
        pathname === href || pathname.startsWith(`${href}/`);

    function toggleCollapsed() {
        const next = !collapsed;

        setCollapsed(next);
        // A year is plenty for a UI preference; not httpOnly because the
        // toggle itself writes it.
        document.cookie = `${SIDEBAR_COOKIE}=${
            next ? "collapsed" : "expanded"
        }; path=/; max-age=31536000; samesite=lax`;
    }

    /** `rail` is false in the mobile drawer, which always shows labels. */
    const renderNav = (rail: boolean) => (
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-4">
            {sections.map((section, index) => (
                <div key={section.title}>
                    {rail ? (
                        index > 0 ? (
                            <div className="mx-2 mb-2 h-px bg-white/10" />
                        ) : null
                    ) : (
                        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                            {section.title}
                        </p>
                    )}

                    <ul className="flex flex-col gap-0.5">
                        {section.items.map((item) => {
                            const active = isActive(item.href);

                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        onClick={() => setMobileOpen(false)}
                                        aria-current={active ? "page" : undefined}
                                        title={rail ? item.label : undefined}
                                        className={`group relative flex items-center rounded-md py-2 text-sm transition-colors ${
                                            rail
                                                ? "justify-center px-2"
                                                : "gap-3 px-3"
                                        } ${
                                            active
                                                ? "bg-white/10 font-medium text-white"
                                                : "text-white/65 hover:bg-white/5 hover:text-white"
                                        }`}
                                    >
                                        {active ? (
                                            <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand" />
                                        ) : null}
                                        <Icon
                                            name={item.icon}
                                            className={`size-4 shrink-0 ${
                                                active
                                                    ? "text-brand"
                                                    : "text-white/45 group-hover:text-white/70"
                                            }`}
                                        />
                                        {rail ? null : (
                                            <>
                                                <span className="truncate">
                                                    {item.label}
                                                </span>
                                                {!item.built ? (
                                                    <span
                                                        title="Not built yet"
                                                        className="ml-auto size-1.5 shrink-0 rounded-full bg-white/25"
                                                    />
                                                ) : null}
                                            </>
                                        )}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </nav>
    );

    const renderBrand = (rail: boolean) => (
        <div
            className={`flex h-16 shrink-0 items-center border-b border-white/10 ${
                rail ? "justify-center px-2" : "gap-3 px-5"
            }`}
        >
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand text-sm font-bold text-chrome-900">
                S
            </span>
            {rail ? null : (
                <span className="leading-tight">
                    <span className="block text-sm font-semibold text-white">
                        SmartPay
                    </span>
                    <span className="block text-[10px] uppercase tracking-[0.14em] text-brand-soft">
                        Solutions
                    </span>
                </span>
            )}
        </div>
    );

    const renderAccount = (rail: boolean) => (
        <div className="shrink-0 border-t border-white/10 p-2">
            <div
                className={`flex rounded-md px-1 py-2 ${
                    rail ? "flex-col items-center gap-2" : "items-center gap-3"
                }`}
            >
                <span
                    title={rail ? `${user.name} · ${user.role}` : undefined}
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-white"
                >
                    {initials(user.name)}
                </span>

                {rail ? null : (
                    <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-sm text-white">
                            {user.name}
                        </span>
                        <span className="block truncate text-[11px] uppercase tracking-wide text-brand-soft">
                            {user.role}
                        </span>
                    </span>
                )}

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
            {/* Desktop rail */}
            <aside
                className={`fixed inset-y-0 left-0 z-30 hidden flex-col bg-chrome-900 transition-[width] duration-200 lg:flex ${
                    collapsed ? "w-16" : "w-60"
                }`}
            >
                {renderBrand(collapsed)}
                {renderNav(collapsed)}
                {renderAccount(collapsed)}

                <button
                    type="button"
                    onClick={toggleCollapsed}
                    aria-label={
                        collapsed ? "Expand navigation" : "Collapse navigation"
                    }
                    aria-expanded={!collapsed}
                    title={collapsed ? "Expand" : "Collapse"}
                    className="flex h-10 shrink-0 items-center justify-center gap-2 border-t border-white/10 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                >
                    <Icon
                        name="chevronLeft"
                        className={`size-4 transition-transform duration-200 ${
                            collapsed ? "rotate-180" : ""
                        }`}
                    />
                    {collapsed ? null : (
                        <span className="text-xs">Collapse</span>
                    )}
                </button>
            </aside>

            {/* Mobile drawer — always full labels */}
            {mobileOpen ? (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <button
                        type="button"
                        aria-label="Close navigation"
                        onClick={() => setMobileOpen(false)}
                        className="absolute inset-0 bg-black/50"
                    />
                    <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-chrome-900">
                        {renderBrand(false)}
                        {renderNav(false)}
                        {renderAccount(false)}
                    </aside>
                </div>
            ) : null}

            <div
                className={`flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ${
                    collapsed ? "lg:pl-16" : "lg:pl-60"
                }`}
            >
                {/* Dark chrome continues across the top bar; the content area
                    below stays light so records remain easy to read. */}
                <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-chrome-900 px-4 sm:px-6">
                    <button
                        type="button"
                        onClick={() => setMobileOpen(true)}
                        aria-label="Open navigation"
                        className="grid size-9 place-items-center rounded-md border border-white/15 text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
                    >
                        <Icon name="menu" className="size-4" />
                    </button>

                    <span className="text-sm font-semibold text-white sm:hidden">
                        SmartPay
                    </span>
                    <span className="hidden text-sm text-white/70 sm:block">
                        Installment Sales &amp; Recovery Management
                    </span>

                    <div className="ml-auto flex items-center gap-3">
                        <span className="hidden text-xs text-white/60 sm:block">
                            {user.email}
                        </span>
                        <ThemeModeToggle current={themeMode} />
                    </div>
                </header>

                <main className="min-w-0 flex-1">{children}</main>
            </div>
        </div>
    );
}
