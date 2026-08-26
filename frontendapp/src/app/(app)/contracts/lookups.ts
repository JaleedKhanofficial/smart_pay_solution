import { apiCall } from "@/lib/api";

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
