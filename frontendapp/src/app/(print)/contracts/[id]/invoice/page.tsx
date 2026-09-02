import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvoiceActions } from "./invoice-actions";
import { ApiError } from "@/api/api.repository";
import { apiCall } from "@/lib/api";
import { amountInWords } from "@/lib/amount-in-words";
import { formatDate } from "@/lib/format";
import { INVOICE_TERMS, renderTerm } from "@/lib/invoice-terms";
import type { Invoice } from "@/types/invoice";
import type { Guarantor } from "@/types/customer";

export const metadata: Metadata = {
    title: "Installment Agreement · SmartPay Solutions",
};

const NAVY = "#13365E";

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

/** Contract 7 prints as SPS-0007 — a reference short enough to say aloud. */
function reference(id: number): string {
    return `SPS-${String(id).padStart(4, "0")}`;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <h2
            className="mb-2 border-b pb-1 text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ color: NAVY, borderColor: NAVY }}
        >
            {children}
        </h2>
    );
}

/** A labelled value. Dotted rule so a blank still reads as a field. */
function Field({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex gap-2 border-b border-dotted border-slate-300 py-[3px]">
            <span className="w-[38%] shrink-0 text-[10px] uppercase tracking-wide">
                {label}
            </span>
            <span className="min-w-0 flex-1 text-[11px] font-medium text-slate-900">
                {value || "—"}
            </span>
        </div>
    );
}

function GuarantorBlock({
    guarantor,
    position,
}: {
    guarantor: Guarantor | undefined;
    position: number;
}) {
    return (
        <div>
            <SectionHeading>Guarantor {position}</SectionHeading>
            {guarantor ? (
                <>
                    <Field label="Name" value={guarantor.full_name} />
                    <Field label="Father / Husband" value={guarantor.father_name} />
                    <Field label="Relationship" value={guarantor.relationship} />
                    <Field label="CNIC" value={guarantor.cnic_number} />
                    <Field label="Mobile" value={guarantor.mobile_number} />
                    <Field label="Address" value={guarantor.address} />
                </>
            ) : (
                // FR-CUS-03-v2 as built: the second guarantor is optional
                // (§2.7 item 4), so the block is kept and left blank rather
                // than dropped — the paper form still has somewhere to write.
                <>
                    <Field label="Name" value="" />
                    <Field label="Father / Husband" value="" />
                    <Field label="Relationship" value="" />
                    <Field label="CNIC" value="" />
                    <Field label="Mobile" value="" />
                    <Field label="Address" value="" />
                </>
            )}
        </div>
    );
}

export default async function InvoicePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;

    if (!/^\d+$/.test(id)) notFound();

    // FR-INV-01: a missing contract is a 404 page, not an error screen.
    const invoice = await apiCall<Invoice>(`/contracts/${id}/invoice`).catch(
        (error: unknown) => {
            if (error instanceof ApiError && error.status === 404) return null;

            throw error;
        }
    );

    if (!invoice) notFound();

    const { contract, customer, business } = invoice;
    const guarantors = customer.guarantors ?? [];

    /**
     * FR-INV-03. What has been collected against each installment, by seq.
     *
     * Empty on a freshly written agreement — which is the case the Received
     * columns were drawn for, to be filled in by hand as each payment is
     * taken. On a contract that has been running, the figures are printed
     * instead and the same document doubles as a statement.
     */
    const received = new Map(
        (invoice.received ?? []).map((row) => [row.seq, row])
    );

    // The schedule reads down two columns rather than one long strip, so a
    // twenty-month plan still fits the page it started on.
    const half = Math.ceil(contract.installments.length / 2);
    const columns = [
        contract.installments.slice(0, half),
        contract.installments.slice(half),
    ];

    const terms: [string, string][] = [
        ["Product price", pkr(contract.sale_price)],
        [`Markup (${contract.markup_pct}%)`, pkr(contract.markup_amount)],
        ["Total payable", pkr(contract.net_amount)],
        ["Down payment received", pkr(contract.down_payment)],
        ["Balance financed", pkr(contract.financed_amount)],
        ["Number of installments", String(contract.plan_months)],
        ["Monthly installment", pkr(contract.monthly_installment)],
        ["First installment due", formatDate(contract.installments[0]?.due_date ?? contract.start_date)],
        ["Agreement date", formatDate(contract.start_date)],
        ["Final installment due", formatDate(contract.end_date)],
    ];

    return (
        <div className="min-h-screen bg-slate-100 print:bg-white">
            <InvoiceActions invoice={invoice} />

            {/* The sheet. Fixed colours, not theme tokens: a document must look
                the same on every machine and in every appearance (NFR-03). */}
            <article className="sps-sheet mx-auto my-6 w-[210mm] max-w-full bg-white p-[14mm] text-slate-900 shadow-lg print:my-0 print:w-auto print:p-0 print:shadow-none">
                {/* ------------------------------------------- letterhead -- */}
                <header
                    className="flex items-start justify-between gap-6 border-b-[3px] pb-3"
                    style={{ borderColor: NAVY }}
                >
                    <div>
                        <h1
                            className="text-[22px] font-bold leading-tight"
                            style={{ color: NAVY }}
                        >
                            {business.name}
                        </h1>
                        <p className="text-[11px] font-medium tracking-wide text-slate-600">
                            {business.tagline}
                        </p>
                        {business.address ? (
                            <p className="mt-1 text-[10px] text-slate-500">
                                {business.address}
                            </p>
                        ) : null}
                        {business.phone || business.email ? (
                            <p className="text-[10px] text-slate-500">
                                {[business.phone, business.email]
                                    .filter(Boolean)
                                    .join("  ·  ")}
                            </p>
                        ) : null}
                    </div>

                    <div className="shrink-0 text-right">
                        <p
                            className="text-[13px] font-bold uppercase tracking-[0.14em]"
                            style={{ color: NAVY }}
                        >
                            Installment
                            <br />
                            Agreement
                        </p>
                        <p className="mt-2 text-[11px] font-semibold text-slate-900">
                            No. {reference(contract.id)}
                        </p>
                        <p className="text-[10px] text-slate-500">
                            Dated {formatDate(contract.start_date)}
                        </p>
                    </div>
                </header>

                {/* --------------------------------------------- headline -- */}
                <div
                    className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded px-4 py-3 text-white"
                    style={{ backgroundColor: NAVY }}
                >
                    <span className="text-[10px] uppercase tracking-[0.14em] opacity-80">
                        Monthly installment
                    </span>
                    <span className="text-[24px] font-bold leading-none">
                        {pkr(contract.monthly_installment)}
                    </span>
                    <span className="text-[11px] opacity-90">
                        For {contract.plan_months} Months, Ending{" "}
                        {formatDate(contract.end_date)}
                    </span>
                </div>

                {/* ------------------------------- purchaser and product --- */}
                <div className="mt-5 grid grid-cols-2 gap-x-8">
                    <div>
                        <SectionHeading>Purchaser</SectionHeading>
                        <Field label="Name" value={customer.full_name} />
                        <Field
                            label="Father / Husband"
                            value={customer.father_husband_name}
                        />
                        <Field label="CNIC" value={customer.cnic_number} />
                        <Field label="Mobile" value={customer.mobile_number} />
                        <Field label="Occupation" value={customer.occupation} />
                        <Field label="Address" value={customer.address} />
                    </div>

                    <div>
                        <SectionHeading>Product</SectionHeading>
                        <Field label="Description" value={contract.product_name} />
                        <Field
                            label="Condition"
                            value={contract.product_condition}
                        />
                        <Field
                            label="Agreement no."
                            value={reference(contract.id)}
                        />
                        <Field
                            label="Delivered on"
                            value={formatDate(contract.start_date)}
                        />
                    </div>
                </div>

                {/* ------------------------------------------ guarantors --- */}
                <div className="mt-5 grid grid-cols-2 gap-x-8">
                    <GuarantorBlock
                        guarantor={guarantors.find((g) => g.position === 1)}
                        position={1}
                    />
                    <GuarantorBlock
                        guarantor={guarantors.find((g) => g.position === 2)}
                        position={2}
                    />
                </div>

                {/* --------------------------------------- payment terms --- */}
                <div className="mt-5">
                    <SectionHeading>Payment terms</SectionHeading>
                    <div className="grid grid-cols-2 gap-x-8">
                        {[terms.slice(0, 5), terms.slice(5)].map(
                            (column, index) => (
                                <div key={index}>
                                    {column.map(([label, value]) => (
                                        <div
                                            key={label}
                                            className="flex justify-between gap-3 border-b border-dotted border-slate-400 py-[3px]"
                                        >
                                            <span className="text-[10px] uppercase tracking-wide">
                                                {label}
                                            </span>
                                            <span className="text-[11px] font-semibold tabular-nums text-slate-900">
                                                {value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </div>

                    <p className="mt-2 text-[10px]">
                        Total payable in words:{" "}
                        <span className="font-semibold text-slate-900">
                            {amountInWords(contract.net_amount)}
                        </span>
                    </p>
                </div>

                {/* --------------------------------- installment schedule -- */}
                <div className="mt-5 break-inside-avoid">
                    <SectionHeading>Installment schedule</SectionHeading>
                    <div className="grid grid-cols-2 gap-x-8">
                        {columns.map((column, index) =>
                            column.length === 0 ? null : (
                                <table
                                    key={index}
                                    className="w-full border-collapse text-[10px]"
                                >
                                    <thead>
                                        <tr className="bg-slate-100">
                                            <th className="border border-slate-700 px-2 py-1 text-left font-semibold">
                                                #
                                            </th>
                                            <th className="border border-slate-700 px-2 py-1 text-left font-semibold">
                                                Due date
                                            </th>
                                            <th className="border border-slate-700 px-2 py-1 text-right font-semibold">
                                                Amount
                                            </th>
                                            <th className="border border-slate-700 px-1.5 py-1 text-right font-semibold">
                                                Received
                                            </th>
                                            <th className="border border-slate-700 px-1.5 py-1 text-left font-semibold">
                                                Paid on
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {column.map((row) => {
                                            const paid = received.get(row.seq);

                                            return (
                                                <tr key={row.seq}>
                                                    <td className="border border-slate-700 px-2 py-[3px] tabular-nums">
                                                        {row.seq}
                                                    </td>
                                                    <td className="border border-slate-700 px-2 py-[3px] tabular-nums">
                                                        {formatDate(
                                                            row.due_date
                                                        )}
                                                    </td>
                                                    <td className="border border-slate-700 px-2 py-[3px] text-right font-medium tabular-nums">
                                                        {pkr(row.amount)}
                                                    </td>
                                                    {/* Both cells stay empty
                                                        until money is applied,
                                                        so a fresh agreement
                                                        still prints a grid to
                                                        fill in by hand. */}
                                                    <td className="border border-slate-700 px-1.5 py-[3px] text-right tabular-nums">
                                                        {paid
                                                            ? pkr(paid.amount)
                                                            : null}
                                                    </td>
                                                    <td className="border border-slate-700 px-1.5 py-[3px] tabular-nums">
                                                        {/* The day the row was
                                                            cleared, not the day
                                                            a payment arrived:
                                                            one payment can
                                                            settle several rows
                                                            (BR-13). Blank while
                                                            it is still short. */}
                                                        {paid?.completed_on
                                                            ? formatDate(
                                                                  paid.completed_on
                                                              )
                                                            : null}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )
                        )}
                    </div>
                </div>

                {/* ------------------------------- terms and conditions ---- */}
                <div className="mt-5">
                    <SectionHeading>Terms and conditions</SectionHeading>
                    <ol className="grid grid-cols-2 gap-x-8 gap-y-[2px] text-[9px] leading-snug">
                        {INVOICE_TERMS.map((term, index) => (
                            <li key={index} className="flex gap-1.5">
                                <span className="shrink-0 font-semibold text-slate-900">
                                    {index + 1}.
                                </span>
                                <span>{renderTerm(term, business.name)}</span>
                            </li>
                        ))}
                    </ol>
                </div>

                {/* ------------------------------------------ signatures --- */}
                <div className="mt-8 grid grid-cols-3 gap-x-8 break-inside-avoid">
                    {[
                        ["Purchaser", customer.full_name],
                        [
                            "Guarantor",
                            guarantors.find((g) => g.position === 1)?.full_name ??
                                "",
                        ],
                        [`For ${business.name}`, ""],
                    ].map(([role, name]) => (
                        <div key={role}>
                            <div className="h-10" />
                            <div className="border-t border-slate-400 pt-1">
                                <p className="text-[10px] font-semibold text-slate-900">
                                    {role}
                                </p>
                                <p className="text-[9px] text-slate-500">
                                    {name || "Name and signature"}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <footer className="mt-6 border-t border-slate-200 pt-2 text-[8px] text-slate-400">
                    {reference(contract.id)} · Generated{" "}
                    {formatDate(invoice.issued_at)} · This document is issued by{" "}
                    {business.name} and is valid without a company seal.
                </footer>
            </article>
        </div>
    );
}
