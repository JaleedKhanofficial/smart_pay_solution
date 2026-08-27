import type { Paginated } from "./customer";

/** One field that moved — FR-AUD-01's before/after diff, computed server-side. */
export type AuditChange = {
    field: string;
    before: unknown;
    after: unknown;
};

export type AuditEntry = {
    id: number;
    actor_id: number | null;
    /** Null where there was no signed-in actor, such as a failed login. */
    actor_name: string | null;
    entity: string;
    entity_id: string | null;
    action: string;
    changes: AuditChange[];
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    ip: string | null;
    created_at: string;
};

/** The values actually present in the log, for the filter dropdowns. */
export type AuditFacets = {
    entities: string[];
    actions: string[];
    actors: { id: number; name: string }[];
};

export type AuditFilterValues = {
    entity: string;
    entity_id: string;
    actor_id: string;
    action: string;
    from: string;
    to: string;
};

export const EMPTY_FILTERS: AuditFilterValues = {
    entity: "",
    entity_id: "",
    actor_id: "",
    action: "",
    from: "",
    to: "",
};

export type { Paginated };
