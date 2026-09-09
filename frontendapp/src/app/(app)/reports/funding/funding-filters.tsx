import Link from "next/link";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { CARD_CLASS } from "@/components/ui/card";
import type {
    FundingFilterValues,
    InvestorFundingRollup,
} from "@/types/funding-report";

const controlClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-chrome-600 sm:py-2 sm:text-sm";

const labelClass =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";

/**
 * FR-IVT-16. The register's filters, as a plain GET form.
 *
 * No client component and no state: the filters live in the query string, so a
 * filtered view is a URL that can be bookmarked or sent to someone, and the
 * page it renders is the same one the server would render for them.
 *
 * The investor list comes from the report itself rather than a second lookup —
 * an investor with no funding has nothing to filter to.
 */
export function FundingFilters({
    values,
    investors,
}: {
    values: FundingFilterValues;
    investors: InvestorFundingRollup[];
}) {
    const active = Object.values(values).filter(Boolean).length;

    return (
        <form
            action="/reports/funding"
            method="get"
            className={`mb-6 ${CARD_CLASS} p-3`}
        >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                <div className="min-w-0">
                    <label className={labelClass} htmlFor="search">
                        Search
                    </label>
                    <div className="relative">
                        <Icon
                            name="search"
                            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                        />
                        <input
                            id="search"
                            name="search"
                            defaultValue={values.search}
                            placeholder="Customer, product, investor or SPS-0001"
                            className={`${controlClass} pl-9`}
                        />
                    </div>
                </div>

                <div className="min-w-0">
                    <label className={labelClass} htmlFor="arrangement">
                        Raised
                    </label>
                    <select
                        id="arrangement"
                        name="arrangement"
                        defaultValue={values.arrangement}
                        className={controlClass}
                    >
                        <option value="">Sole and joint</option>
                        <option value="sole">Sole — one investor</option>
                        <option value="joint">Joint — several</option>
                    </select>
                </div>

                <div className="min-w-0">
                    <label className={labelClass} htmlFor="investor_id">
                        Investor
                    </label>
                    <select
                        id="investor_id"
                        name="investor_id"
                        defaultValue={values.investor_id}
                        className={controlClass}
                    >
                        <option value="">Everyone</option>
                        {investors.map((investor) => (
                            <option
                                key={investor.investor_id}
                                value={String(investor.investor_id)}
                            >
                                {investor.investor_name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="min-w-0">
                    <label className={labelClass} htmlFor="status">
                        Status
                    </label>
                    <select
                        id="status"
                        name="status"
                        defaultValue={values.status}
                        className={controlClass}
                    >
                        <option value="">Any status</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>

                <div className="flex items-end gap-2">
                    <Button type="submit" size="sm">
                        Apply
                    </Button>
                    {active > 0 ? (
                        <Link
                            href="/reports/funding"
                            className="text-sm text-muted underline hover:text-foreground"
                        >
                            Clear
                        </Link>
                    ) : null}
                </div>
            </div>
        </form>
    );
}
