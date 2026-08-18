import type { ReactNode } from "react";

type Props = {
    title: string;
    description?: string;
    eyebrow?: string;
    actions?: ReactNode;
};

export function PageHeader({ title, description, eyebrow, actions }: Props) {
    return (
        <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
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
            {actions ? (
                <div className="flex w-full gap-2 sm:w-auto">{actions}</div>
            ) : null}
        </header>
    );
}
