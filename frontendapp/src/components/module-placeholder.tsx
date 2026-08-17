import { Icon } from "./icons";
import { PageHeader } from "./page-header";
import type { NavItem } from "@/lib/navigation";

/**
 * Stub screen for a module that has a route and a place in the sidebar but no
 * implementation yet. It states what the module will do, so the shell reads as
 * a roadmap rather than a set of dead links.
 */
export function ModulePlaceholder({ item }: { item: NavItem }) {
    return (
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            <PageHeader
                eyebrow={`Module ${item.module}`}
                title={item.label}
                description={item.summary}
            />

            <div className="rounded-xl border border-border bg-surface">
                <div className="flex items-center gap-3 border-b border-border px-5 py-4">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-gold/12 text-gold">
                        <Icon name={item.icon} className="size-4.5" />
                    </span>
                    <div>
                        <p className="text-sm font-medium text-foreground">
                            Not built yet
                        </p>
                        <p className="text-xs text-muted">
                            The route, the sidebar entry and the database tables
                            exist. The API and screens come next.
                        </p>
                    </div>
                </div>

                <div className="px-5 py-5">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                        Planned scope
                    </p>
                    <ul className="flex flex-col gap-2">
                        {item.capabilities.map((capability) => (
                            <li
                                key={capability}
                                className="flex gap-3 text-sm text-foreground"
                            >
                                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold" />
                                <span>{capability}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
