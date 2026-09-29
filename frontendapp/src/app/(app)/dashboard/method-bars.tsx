import { Card, CardHeader } from "@/components/ui/card";
import type { Dashboard } from "@/types/dashboard";

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

/**
 * FR-DSH-19. How the money came in, as one bar per method.
 *
 * A single hue: the bars answer "how much of the whole", which is magnitude,
 * not identity, so they share one colour and differ only in length. The
 * largest is the full width and the rest are measured against it.
 */
export function MethodBars({
    rows,
    periodic,
}: {
    rows: Dashboard["collections_by_method"];
    periodic: boolean;
}) {
    const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
    const largest = rows.reduce(
        (max, row) => Math.max(max, Number(row.amount)),
        0
    );

    return (
        <Card className="flex flex-col">
            <CardHeader
                title="Collections by method"
                description={
                    periodic
                        ? "How the money in the period came in."
                        : "How the money has come in, all time."
                }
            />

            {rows.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted sm:px-5">
                    Nothing collected{periodic ? " in the period" : ""}.
                </p>
            ) : (
                <ul className="flex flex-col gap-3 px-4 py-4 sm:px-5">
                    {rows.map((row) => {
                        const amount = Number(row.amount);
                        const share = total > 0 ? (amount / total) * 100 : 0;
                        const width =
                            largest > 0 ? (amount / largest) * 100 : 0;

                        return (
                            <li key={row.method} className="text-sm">
                                <div className="mb-1 flex items-baseline justify-between gap-3">
                                    <span className="text-foreground">
                                        {row.method}
                                        <span className="ml-2 text-xs text-muted">
                                            {row.count} payment
                                            {row.count === 1 ? "" : "s"}
                                        </span>
                                    </span>
                                    <span className="tabular-nums text-foreground">
                                        {pkr(row.amount)}
                                        <span className="ml-2 text-xs text-muted">
                                            {share.toFixed(0)}%
                                        </span>
                                    </span>
                                </div>
                                <div
                                    className="h-2 w-full overflow-hidden rounded-full bg-surface-muted"
                                    role="img"
                                    aria-label={`${row.method}: ${pkr(row.amount)}, ${share.toFixed(0)} percent`}
                                >
                                    <div
                                        className="h-full rounded-full bg-chrome-700"
                                        style={{ width: `${Math.max(width, 2)}%` }}
                                    />
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
}
