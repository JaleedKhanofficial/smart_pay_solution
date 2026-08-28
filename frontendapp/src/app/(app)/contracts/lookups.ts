import { apiCall } from "@/lib/api";
import type { FundableInvestor } from "@/types/investor";

export type Option = { value: string; label: string };

type LookupOption = { id: number; label: string };

/**
 * The customer and product pickers, from the dedicated lookup routes rather
 * than page one of the register — a picker capped at 100 rows would make the
 * 101st record unselectable with nothing on screen to explain it.
 *
 * A failed lookup yields an empty list rather than throwing: the page still
 * renders, and the empty dropdown is itself the symptom.
 */
export async function loadPickers(): Promise<{
    customers: Option[];
    products: Option[];
}> {
    const [customers, products] = await Promise.all([
        apiCall<LookupOption[]>("/customers/lookup").catch(
            () => [] as LookupOption[]
        ),
        apiCall<LookupOption[]>("/products/lookup").catch(
            () => [] as LookupOption[]
        ),
    ]);

    const toOption = (row: LookupOption): Option => ({
        value: String(row.id),
        label: row.label,
    });

    return {
        customers: customers.map(toOption),
        products: products.map(toOption),
    };
}

/**
 * A contract can name a product that has since been set Inactive, or a customer
 * since deleted — neither is offered by the lookups. Folding the stored value
 * back in keeps the edit form honest: without it the picker renders blank, and
 * saving would silently rewrite the record to whatever was chosen instead.
 */
export function withCurrent(
    options: Option[],
    id: number,
    label: string
): Option[] {
    const value = String(id);

    return options.some((option) => option.value === value)
        ? options
        : [{ value, label: `${label} — no longer selectable` }, ...options];
}

/**
 * FR-CON-11. Investors with capital to deploy, for the funding panel.
 *
 * Admin-only on the API (NFR-15), so an operator's call 403s — and that is
 * handled the same way a failed lookup is: an empty list, which renders no
 * funding card at all. The operator writes a house-funded contract, which is
 * what FR-CON-13 says an unfunded contract is.
 */
export async function loadFundableInvestors(): Promise<FundableInvestor[]> {
    return apiCall<FundableInvestor[]>("/investors/fundable").catch(
        () => [] as FundableInvestor[]
    );
}
