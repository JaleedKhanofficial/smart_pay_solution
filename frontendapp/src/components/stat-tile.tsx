import { Badge } from "./ui/badge";
import { Card } from "./ui/card";

type Props = {
    label: string;
    value: string;
    hint?: string;
    /** Marks a figure the API cannot supply yet. */
    pending?: boolean;
};

export function StatTile({ label, value, hint, pending }: Props) {
    return (
        <Card className="flex flex-col p-4">
            <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide">
                    {label}
                </p>
                {pending ? <Badge tone="accent">Pending</Badge> : null}
            </div>
            <p
                // Three tiles abreast on a narrow tablet leave roughly 190px
                // each; the figure steps up only once there is room for it.
                className={`mt-3 text-xl font-semibold tracking-tight tabular-nums lg:text-2xl ${
                    pending ? "text-muted/50" : "text-foreground"
                }`}
            >
                {value}
            </p>
            {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </Card>
    );
}
