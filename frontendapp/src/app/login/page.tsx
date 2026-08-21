import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
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
            <div className="hidden w-1/2 flex-col justify-between bg-chrome-900 p-12 lg:flex">
                <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-md bg-brand text-base font-bold text-chrome-900">
                        S
                    </span>
                    <span className="leading-tight">
                        <span className="block text-sm font-semibold text-white">
                            SmartPay
                        </span>
                        <span className="block text-[10px] uppercase tracking-[0.14em] text-brand-soft">
                            Solutions
                        </span>
                    </span>
                </div>

                <div className="max-w-md">
                    <p className="text-2xl font-semibold leading-snug text-white">
                        Easy Monthly Installments
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-white/60">
                        Customers, contracts, collections and recovery - one
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
                        <span className="grid size-9 place-items-center rounded-md bg-brand text-base font-bold text-chrome-900">
                            S
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                            SmartPay Solutions
                        </span>
                    </div>

                    {/* Same card shell as the customer form sections. */}
                    <Card>
                        <CardHeader
                            title="Sign in"
                            description="Use your staff account to continue."
                        />
                        <CardBody>
                            <LoginForm />
                        </CardBody>
                    </Card>
                </div>
            </div>
        </div>
    );
}
