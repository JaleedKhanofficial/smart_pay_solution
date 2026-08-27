import type { IconName } from "@/components/icons";
import type { Role } from "@/types/customer";

export type NavItem = {
    /** Module number from SRS §3, shown in the placeholder header. */
    module: number;
    label: string;
    href: string;
    icon: IconName;
    /** Empty means every signed-in role (SRS §2.3). */
    roles?: Role[];
    built: boolean;
    /** Requirement IDs this module will satisfy, listed on the stub page. */
    summary: string;
    capabilities: string[];
};

export type NavSection = {
    title: string;
    items: NavItem[];
};

export const NAVIGATION: NavSection[] = [
    {
        title: "Overview",
        items: [
            {
                module: 1,
                label: "Dashboard",
                href: "/dashboard",
                icon: "dashboard",
                built: false,
                summary: "Portfolio KPIs in a single aggregate call.",
                capabilities: [
                    "FR-DSH-01..03 — today, this month and all-time collections",
                    "FR-DSH-04-v2 — total outstanding, markup included",
                    "FR-DSH-05..08 — active plans, products, customers, contracts",
                    "FR-DSH-09 — five most recent payments",
                    "FR-DSH-10-v2 — mature profit per BR-09",
                    "FR-DSH-12 — past-due attention strip",
                ],
            },
        ],
    },
    {
        title: "Operations",
        items: [
            {
                module: 2,
                label: "Customers",
                href: "/customers",
                icon: "users",
                built: true,
                summary: "Customer register with guarantors and CNIC images.",
                capabilities: [],
            },
            {
                module: 3,
                label: "Products",
                href: "/products",
                icon: "box",
                built: true,
                summary: "Product catalogue and categories.",
                capabilities: [],
            },
            {
                module: 4,
                label: "Contracts",
                href: "/contracts",
                icon: "fileText",
                built: true,
                summary:
                    "Installment agreements, priced and scheduled server-side, with the printed agreement.",
                capabilities: [],
            },
            {
                module: 6,
                label: "Payments",
                href: "/payments",
                icon: "creditCard",
                built: true,
                summary: "Collection against a contract, inside one transaction.",
                capabilities: [],
            },
        ],
    },
    {
        title: "Analysis",
        items: [
            {
                module: 7,
                label: "Recovery",
                href: "/recovery",
                icon: "trendingUp",
                built: false,
                summary:
                    "Ledger derived from the schedule and the payments table.",
                capabilities: [
                    "FR-REC-02-v2 — payments applied oldest due date first",
                    "FR-REC-03 — per-month variance and punctuality per BR-06-v2",
                    "FR-REC-06 — loyalty tier per BR-07",
                    "FR-REC-08 — immutable archive snapshots",
                ],
            },
            {
                module: 8,
                label: "Summary Report",
                href: "/reports/summary",
                icon: "barChart",
                built: false,
                summary: "Portfolio workbook with profit maturity and capital.",
                capabilities: [
                    "FR-SUM-01-v2 — one row per contract, all BR-08 columns server-side",
                    "FR-SUM-02-v2 — capital and expenses as database records",
                    "FR-SUM-04-v2 — simulation mode with saved scenarios",
                    "FR-SUM-07 — top performer and client profile modals",
                ],
            },
        ],
    },
    {
        title: "Administration",
        items: [
            {
                module: 9,
                label: "Users",
                href: "/settings/users",
                icon: "shield",
                roles: ["admin"],
                built: false,
                summary: "Staff accounts and roles.",
                capabilities: [
                    "FR-USR-01 — list, create, edit, disable, soft-delete",
                    "FR-USR-02-v2 — Argon2id passwords, minimum 10 characters",
                    "FR-USR-03 — an admin cannot demote or disable themselves",
                ],
            },
            {
                module: 10,
                label: "Recycle Bin",
                href: "/settings/recycle-bin",
                icon: "trash",
                roles: ["admin"],
                built: false,
                summary: "Restore or purge soft-deleted records.",
                capabilities: [
                    "FR-BIN-01 — deleted customers, products, contracts and voided payments",
                    "FR-BIN-02 — restore, blocked when it would break uniqueness",
                    "FR-BIN-03 — purge behind typed confirmation, audit-logged",
                ],
            },
            {
                module: 11,
                label: "Audit Log",
                href: "/settings/audit",
                icon: "history",
                roles: ["admin"],
                built: false,
                summary: "Append-only record of every write.",
                capabilities: [
                    "FR-AUD-01 — actor, entity, before/after diff, timestamp, IP",
                    "FR-AUD-02 — filter by entity, actor, action and date range",
                    "Auth events are already being recorded",
                ],
            },
            {
                module: 12,
                label: "System Settings",
                href: "/settings/system",
                icon: "settings",
                roles: ["admin"],
                built: true,
                summary: "Business rules that change without a redeploy.",
                capabilities: [],
            },
        ],
    },
];

export function visibleSections(role: Role): NavSection[] {
    return NAVIGATION.map((section) => ({
        ...section,
        items: section.items.filter(
            (item) => !item.roles || item.roles.includes(role)
        ),
    })).filter((section) => section.items.length > 0);
}

export function findNavItem(href: string): NavItem | undefined {
    return NAVIGATION.flatMap((section) => section.items).find(
        (item) => item.href === href
    );
}
