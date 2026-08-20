import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { StatTile } from "@/components/stat-tile";
import { Card } from "@/components/ui/card";
import { apiCall } from "@/lib/api";
import type { Customer, Paginated } from "@/types/customer";

export const metadata: Metadata = {
    title: "Dashboard · SmartPay Solutions",
};

/** Placeholder for every figure GET /api/v1/dashboard will supply. */
const TBD = "—";

export default async function DashboardPage() {
    // The only tile with a real source today: FR-DSH-07.
    const customerCount = await apiCall<Paginated<Customer>>(
        "/customers?page=1&pageSize=1"
    )
        .then((page) => page.total)
        .catch(() => null);

    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <PageHeader
                eyebrow="Module 1"
                title="Dashboard"
                description="Portfolio at a glance."
            />

            <div className="mb-8 flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/8 px-4 py-3">
                <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-gold-ink" />
                <p className="text-sm text-foreground">
                    <span className="font-medium">
                        The dashboard API is not built yet.
                    </span>{" "}
                    <span className="text-muted">
                        Tiles marked <em>Pending</em> will fill in once{" "}
                        <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-xs">
                            GET /api/v1/dashboard
                        </code>{" "}
                        returns the FR-DSH aggregate. Collections need Module 6,
                        outstanding and profit need Module 4.
                    </span>
                </p>
            </div>

            <section className="mb-8">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    Collections
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatTile
                        label="Today"
                        value={TBD}
                        hint="FR-DSH-01"
                        pending
                    />
                    <StatTile
                        label="This month"
                        value={TBD}
                        hint="FR-DSH-02"
                        pending
                    />
                    <StatTile
                        label="All time"
                        value={TBD}
                        hint="FR-DSH-03"
                        pending
                    />
                    <StatTile
                        label="Total outstanding"
                        value={TBD}
                        hint="FR-DSH-04-v2 · markup included"
                        pending
                    />
                </div>
            </section>

            <section className="mb-8">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    Portfolio
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatTile
                        label="Customers"
                        value={customerCount === null ? TBD : String(customerCount)}
                        hint="FR-DSH-07 · live"
                        pending={customerCount === null}
                    />
                    <StatTile
                        label="Contracts"
                        value={TBD}
                        hint="FR-DSH-08"
                        pending
                    />
                    <StatTile
                        label="Active plans"
                        value={TBD}
                        hint="FR-DSH-05"
                        pending
                    />
                    <StatTile
                        label="Active products"
                        value={TBD}
                        hint="FR-DSH-06"
                        pending
                    />
                </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-3">
                <section className="lg:col-span-2">
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                        Recent payments
                    </h2>
                    <Card>
                        <div className="px-5 py-12 text-center">
                            <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-surface-muted text-muted">
                                <Icon name="creditCard" className="size-5" />
                            </span>
                            <p className="text-sm font-medium text-foreground">
                                No payments recorded
                            </p>
                            <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
                                The five most recent payments appear here
                                (FR-DSH-09) once Module 6 is built.
                            </p>
                        </div>
                    </Card>
                </section>

                <section>
                    <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                        Attention
                    </h2>
                    <Card className="flex h-[calc(100%-1.75rem)] flex-col p-5">
                        <p className="text-sm font-medium text-foreground">
                            Past-due installments
                        </p>
                        <p className="mt-1 text-xs text-muted">
                            FR-DSH-12 counts contracts with an unpaid
                            installment at least one day overdue, and links to
                            the filtered contract list.
                        </p>
                        <p className="mt-6 text-3xl font-semibold tabular-nums text-muted/50">
                            {TBD}
                        </p>
                        <p className="mt-auto pt-6 text-xs text-muted">
                            Needs the installment schedule from{" "}
                            <Link
                                href="/contracts"
                                className="text-gold-ink underline-offset-2 hover:underline"
                            >
                                Module 4
                            </Link>
                            .
                        </p>
                    </Card>
                </section>
            </div>
        </div>
    );
}
