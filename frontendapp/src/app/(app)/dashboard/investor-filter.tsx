"use client";

import { useRouter } from "next/navigation";
import { ComboboxField } from "@/components/ui/combobox";

/**
 * FR-DSH-13. Narrow the dashboard to one investor.
 *
 * The choice goes into the query string and the page re-renders on the
 * server, so a filtered dashboard is a URL — bookmarkable, and the same one
 * the server would render for anybody else. "All investors" is a real option
 * rather than an empty box, so the current state is always readable.
 */
export function InvestorFilter({
    investors,
    selected,
}: {
    investors: { id: number; label: string }[];
    selected: string;
}) {
    const router = useRouter();

    const options = [
        { value: "all", label: "All investors" },
        ...investors.map((investor) => ({
            value: String(investor.id),
            label: investor.label,
        })),
    ];

    return (
        <div className="w-full sm:w-72">
            <ComboboxField
                label="Investor"
                name="investor"
                options={options}
                defaultValue={selected || "all"}
                onValueChange={(value) =>
                    router.push(
                        value === "all"
                            ? "/dashboard"
                            : `/dashboard?investor=${value}`
                    )
                }
            />
        </div>
    );
}
