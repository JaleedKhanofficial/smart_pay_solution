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

            <div className="flex flex-1 items-center justify-center px-6 py-16">
                <div className="w-full max-w-sm">
                    <header className="mb-8">
                        <div className="mb-6 flex items-center gap-3 lg:hidden">
                            <span className="grid size-9 place-items-center rounded-md bg-gold text-base font-bold text-navy-900">
                                S
                            </span>
                            <span className="text-sm font-semibold text-foreground">
                                SmartPay Solutions
                            </span>
                        </div>
                        <h1 className="text-xl font-semibold tracking-tight text-foreground">
                            Sign in
                        </h1>
                        <p className="mt-1 text-sm text-muted">
                            Use your staff account to continue.
                        </p>
                    </header>

                    <LoginForm />
                </div>
            </div>
        </div>
    );
}
