import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { readTokens } from "@/lib/session";

export const metadata: Metadata = {
    title: "Sign in · SmartPay Solutions",
};

export default async function LoginPage() {
    const { access } = await readTokens();

    if (access) redirect("/dashboard");

    return (
        <div className="flex min-h-dvh">
            {/* Brand panel — hidden on small screens */}
            <div className="hidden w-1/2 flex-col justify-between bg-navy-900 p-12 lg:flex">
                <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-md bg-gold text-base font-bold text-navy-900">
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

                <div className="max-w-md">
                    <p className="text-2xl font-semibold leading-snug text-white">
                        Easy Monthly Installments
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-white/60">
                        Customers, contracts, collections and recovery — one
                        register, with every figure computed and enforced on
                        the server.
                    </p>
                </div>

                <p className="text-xs text-white/35">
                    Installment Sales &amp; Recovery Management
                </p>
            </div>

            <div className="flex flex-1 items-center justify-center px-5 py-12 sm:px-6 sm:py-16">
                <div className="w-full max-w-sm">
                    {/* The brand panel is hidden below lg, so the mark is
                        repeated above the card on small screens. */}
                    <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
                        <span className="grid size-9 place-items-center rounded-md bg-gold text-base font-bold text-navy-900">
                            S
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                            SmartPay Solutions
                        </span>
                    </div>

                    {/* Same card shell as the customer form sections. */}
                    <div className="rounded-xl border border-border bg-surface">
                        <header className="border-b border-border px-5 py-4 sm:px-6 sm:py-5">
                            <h1 className="text-base font-semibold tracking-tight text-foreground">
                                Sign in
                            </h1>
                            <p className="mt-0.5 text-xs text-muted">
                                Use your staff account to continue.
                            </p>
                        </header>

                        <div className="px-5 py-5 sm:px-6 sm:py-6">
                            <LoginForm />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
