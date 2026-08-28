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
                built: true,
                summary: "Portfolio KPIs in a single aggregate call.",
                capabilities: [],
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
                built: true,
                summary:
                    "Ledger derived from the schedule and the payments table.",
                capabilities: [],
            },
            {
                module: 8,
                label: "Summary Report",
                href: "/reports/summary",
                icon: "barChart",
                roles: ["admin"],
                built: true,
                summary: "Portfolio workbook with profit maturity and capital.",
                capabilities: [],
            },
        ],
    },
    {
        title: "Administration",
        items: [
            {
                module: 13,
                label: "Investors",
                href: "/investors",
                icon: "users",
                roles: ["admin"],
                built: true,
                summary: "Capital put in by other people, and what it has earned.",
                capabilities: [],
            },
            {
                module: 9,
                label: "Users",
                href: "/settings/users",
                icon: "shield",
                roles: ["admin"],
                built: true,
                summary: "Staff accounts and roles.",
                capabilities: [],
            },
            {
                module: 10,
                label: "Recycle Bin",
                href: "/settings/recycle-bin",
                icon: "trash",
                roles: ["admin"],
                built: true,
                summary: "Restore or purge soft-deleted records.",
                capabilities: [],
            },
            {
                module: 11,
                label: "Audit Log",
                href: "/settings/audit",
                icon: "history",
                roles: ["admin"],
                built: true,
                summary: "Append-only record of every write.",
                capabilities: [],
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
