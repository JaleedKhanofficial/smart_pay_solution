import type { ReactNode } from "react";

type Props = {
    title: string;
    description?: string;
    eyebrow?: string;
    actions?: ReactNode;
};

export function PageHeader({ title, description, eyebrow, actions }: Props) {
    return (
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
                {eyebrow ? (
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                        {eyebrow}
                    </p>
                ) : null}
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    {title}
                </h1>
                {description ? (
                    <p className="mt-1 text-sm text-muted">{description}</p>
                ) : null}
            </div>
            {actions ? <div className="flex gap-2">{actions}</div> : null}
        </header>
    );
}
