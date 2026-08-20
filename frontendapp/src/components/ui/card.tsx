import type { ReactNode } from "react";

/**
 * Exported for the cases that are not a <div> — a <form> that is itself the
 * card, for instance. Card below is the usual way in.
 */
export const CARD_CLASS = "rounded-xl border border-border bg-surface";

/**
 * The surface every panel in the application sits on. Padding steps up at sm:
 * so phones keep their width (NFR-12).
 */
export function Card({
    className = "",
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return (
        <div
            className={`${CARD_CLASS} ${className}`.trim()}
        >
            {children}
        </div>
    );
}

export function CardHeader({
    title,
    description,
    actions,
    className = "",
}: {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5 sm:py-4 ${className}`.trim()}
        >
            <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">
                    {title}
                </h2>
                {description ? (
                    <p className="mt-0.5 text-xs text-muted">{description}</p>
                ) : null}
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
    );
}

export function CardBody({
    className = "",
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={`px-4 py-4 sm:px-5 sm:py-5 ${className}`.trim()}>
            {children}
        </div>
    );
}

/** Body laid out as the standard field grid: 1 / 2 / 3 columns. */
export function CardFields({
    className = "",
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return (
        <CardBody
            className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`.trim()}
        >
            {children}
        </CardBody>
    );
}

/** Footer strip for the actions that close a form. */
export function CardFooter({
    className = "",
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return (
        <div
            className={`flex flex-col-reverse gap-3 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:px-5 ${className}`.trim()}
        >
            {children}
        </div>
    );
}
