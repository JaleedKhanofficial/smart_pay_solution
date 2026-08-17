type Props = {
    label: string;
    value: string;
    hint?: string;
    /** Marks a figure the API cannot supply yet. */
    pending?: boolean;
};

export function StatTile({ label, value, hint, pending }: Props) {
    return (
        <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {label}
                </p>
                {pending ? (
                    <span className="rounded-full bg-gold/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gold">
                        Pending
                    </span>
                ) : null}
            </div>
            <p
                className={`mt-3 text-2xl font-semibold tracking-tight tabular-nums ${
                    pending ? "text-muted/50" : "text-foreground"
                }`}
            >
                {value}
            </p>
            {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </div>
    );
}
