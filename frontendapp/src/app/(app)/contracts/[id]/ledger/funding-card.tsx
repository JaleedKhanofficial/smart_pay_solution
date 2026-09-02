import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import type { ContractFunding } from "@/types/investor";

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

/**
 * FR-CON-11. Who funded this contract, shown on the ledger because this is
 * where a contract's money is read.
 *
 * `print:hidden` on purpose: the printed ledger goes to the customer, and who
 * backed the deal is none of their business.
 *
 * Read-only, with no edit control anywhere — BR-19 fixes these shares at
 * activation and every recovery since has been split by them, so changing one
 * would silently rewrite history that has already been paid out against.
 */
export function FundingCard({ fundings }: { fundings: ContractFunding[] }) {
    if (fundings.length === 0) return null;

    const funded = fundings.reduce((sum, row) => sum + Number(row.amount), 0);

    return (
        <Card className="mb-6 overflow-x-auto print:hidden">
            <CardHeader
                title="Funded by"
                description="Fixed when the contract was activated (BR-19). Every recovery above is split by these shares."
                actions={
                    <Badge tone="neutral">
                        {`Rs. ${money.format(funded)} of investor capital`}
                    </Badge>
                }
            />
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead className="border-b border-border bg-surface-muted text-xs font-semibold uppercase tracking-wide text-muted">
                    <tr>
                        <th className="px-4 py-3 font-medium">Investor</th>
                        <th className="px-4 py-3 text-right font-medium">
                            Amount
                        </th>
                        <th className="px-4 py-3 text-right font-medium">
                            Share
                        </th>
                        <th className="px-4 py-3 font-medium">Funded from</th>
                        <th className="px-4 py-3 font-medium">On</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {fundings.map((row) => (
                        <tr key={row.id} className="align-middle">
                            <td className="px-4 py-3">
                                <a
                                    href={`/investors/${row.investor_id}`}
                                    className="font-medium text-foreground hover:underline"
                                >
                                    {row.investor_name}
                                </a>
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">
                                {pkr(row.amount)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-muted">
                                {row.share_pct}%
                            </td>
                            <td className="px-4 py-3 text-xs text-muted">
                                {/* BR-23. Reinvestment is not a separate act —
                                    it is a deployment that drew on profit. */}
                                {row.reinvested ? (
                                    <span className="flex flex-wrap items-center gap-1.5">
                                        <Badge tone="positive">
                                            reinvested
                                        </Badge>
                                        {Number(row.funded_from_principal) > 0
                                            ? `${pkr(row.funded_from_profit)} profit + ${pkr(row.funded_from_principal)} principal`
                                            : `${pkr(row.funded_from_profit)} profit`}
                                    </span>
                                ) : (
                                    "Principal"
                                )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs tabular-nums text-muted">
                                {formatDate(row.funded_at)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Card>
    );
}
