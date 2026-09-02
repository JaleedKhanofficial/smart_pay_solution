import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { amountInWords } from "./amount-in-words";
import { formatDate } from "./format";
import { INVOICE_TERMS, renderTerm } from "./invoice-terms";
import type { Invoice } from "@/types/invoice";

/**
 * FR-INV-06. The installment agreement as a downloadable PDF.
 *
 * Drawn from the invoice **data**, the same way the recovery ledger is
 * (`ledger-pdf.ts`), rather than captured from the screen. A DOM capture is a
 * blurry raster of several megabytes whose text cannot be selected, and it
 * inherits whatever appearance the viewer happened to have — the fault that
 * once made a printed ledger come out white on white. Building from the data
 * gives vector text, a small file, and the same document on every machine.
 *
 * The layout deliberately follows the printed page section for section, so the
 * downloaded file and the browser's own Print both produce the same agreement.
 *
 * jsPDF works in millimetres on A4 here, so every number below is a millimetre.
 */

const NAVY: [number, number, number] = [19, 54, 94];
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const RULE: [number, number, number] = [203, 213, 225];
const DOTTED: [number, number, number] = [148, 163, 184];
const HEAD_FILL: [number, number, number] = [241, 245, 249];

const MARGIN = 14;
const GUTTER = 8;
/** A4 is 210mm; two columns inside the margins with a gutter between. */
const COLUMN = (210 - MARGIN * 2 - GUTTER) / 2;
const RIGHT_COLUMN_X = MARGIN + COLUMN + GUTTER;

/** The footer rule sits 12mm off the bottom; nothing may cross it. */
const FOOTER_RULE = 12;
/** A signature block is a ruled line plus two lines of text beneath it. */
const SIGNATURE_HEIGHT = 9;

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

/** Contract 7 prints as SPS-0007 — a reference short enough to say aloud. */
function reference(id: number): string {
    return `SPS-${String(id).padStart(4, "0")}`;
}

/**
 * Windows, macOS and Linux between them reject `\ / : * ? " < > |`, and a
 * trailing dot or space breaks Explorer. Anything outside the safe set becomes
 * a hyphen, and runs of hyphens collapse so a name of punctuation cannot
 * produce `----`.
 */
function safeFilePart(value: string): string {
    return value
        .normalize("NFKD")
        .replace(/[^\w\s.-]/g, "")
        .trim()
        .replace(/[\s.]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-|-$/g, "");
}

/** `SPS-0007-Agreement-Afaq-Khan-17444-4444444-4.pdf` */
export function invoiceFileName(invoice: Invoice): string {
    const { contract, customer } = invoice;

    const parts = [
        reference(contract.id),
        "Agreement",
        safeFilePart(customer.full_name),
        safeFilePart(customer.cnic_number),
    ].filter(Boolean);

    return `${parts.join("-")}.pdf`;
}

/** The navy rule-under-caps heading the printed sheet uses. */
function sectionHeading(doc: jsPDF, text: string, x: number, y: number, width: number): number {
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...NAVY);
    doc.text(text.toUpperCase(), x, y, { charSpace: 0.3 });

    doc.setDrawColor(...NAVY).setLineWidth(0.3);
    doc.line(x, y + 1.6, x + width, y + 1.6);

    return y + 5;
}

/**
 * A block of label/value rows under a dotted rule, as the sheet draws them.
 *
 * Written directly rather than through `autoTable` because these are fields on
 * a form, not a table: the rule runs the full column width whether the value is
 * there or not, which is what makes a blank still read as somewhere to write.
 */
function fieldBlock(
    doc: jsPDF,
    rows: [string, string][],
    x: number,
    y: number,
    width: number,
): number {
    let cursor = y;

    for (const [label, value] of rows) {
        doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...MUTED);
        doc.text(label.toUpperCase(), x, cursor, { charSpace: 0.15 });

        doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...INK);

        // Long addresses are clipped to the column rather than wrapped: a field
        // that grows would push the two columns out of alignment with each
        // other, and the full address is on the customer record regardless.
        const valueX = x + width * 0.38;
        const [line] = doc.splitTextToSize(value || "—", width - width * 0.38);
        doc.text(line, valueX, cursor);

        doc.setDrawColor(...DOTTED).setLineWidth(0.1);
        doc.line(x, cursor + 1.4, x + width, cursor + 1.4);

        cursor += 5;
    }

    return cursor;
}

/** Label left, value right, under a dotted rule — the payment-terms style. */
function termsBlock(
    doc: jsPDF,
    rows: [string, string][],
    x: number,
    y: number,
    width: number,
): number {
    let cursor = y;

    for (const [label, value] of rows) {
        doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...MUTED);
        doc.text(label.toUpperCase(), x, cursor, { charSpace: 0.15 });

        doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...INK);
        doc.text(value, x + width, cursor, { align: "right" });

        doc.setDrawColor(...DOTTED).setLineWidth(0.1);
        doc.line(x, cursor + 1.4, x + width, cursor + 1.4);

        cursor += 5;
    }

    return cursor;
}

export function buildInvoicePdf(invoice: Invoice): jsPDF {
    const { contract, customer, business } = invoice;
    const guarantors = customer.guarantors ?? [];

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const right = width - MARGIN;

    /**
     * FR-INV-03. What has been collected against each installment, by seq.
     * Empty on a fresh agreement, where the two columns are filled in by hand.
     */
    const received = new Map(
        (invoice.received ?? []).map((row) => [row.seq, row]),
    );

    // ------------------------------------------------------- letterhead --
    doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(...NAVY);
    doc.text(business.name, MARGIN, 18);

    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...MUTED);
    doc.text(business.tagline, MARGIN, 23);

    doc.setFontSize(7.5);
    let headY = 27;

    if (business.address) {
        doc.text(business.address, MARGIN, headY);
        headY += 3.5;
    }

    const contact = [business.phone, business.email].filter(Boolean).join("  ·  ");

    if (contact) doc.text(contact, MARGIN, headY);

    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...NAVY);
    doc.text("INSTALLMENT", right, 17, { align: "right", charSpace: 0.4 });
    doc.text("AGREEMENT", right, 22, { align: "right", charSpace: 0.4 });

    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...INK);
    doc.text(`No. ${reference(contract.id)}`, right, 28, { align: "right" });

    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
    doc.text(`Dated ${formatDate(contract.start_date)}`, right, 32, {
        align: "right",
    });

    doc.setDrawColor(...NAVY).setLineWidth(0.7);
    doc.line(MARGIN, 35, right, 35);

    // --------------------------------------------------------- headline --
    doc.setFillColor(...NAVY);
    doc.roundedRect(MARGIN, 39, right - MARGIN, 13, 1, 1, "F");

    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(255, 255, 255);
    doc.text("MONTHLY INSTALLMENT", MARGIN + 4, 46.5, { charSpace: 0.4 });

    doc.setFont("helvetica", "bold").setFontSize(17);
    doc.text(pkr(contract.monthly_installment), width / 2, 47.5, {
        align: "center",
    });

    doc.setFont("helvetica", "normal").setFontSize(8);
    doc.text(
        `For ${contract.plan_months} Months, Ending ${formatDate(contract.end_date)}`,
        right - 4,
        46.5,
        { align: "right" },
    );

    // ------------------------------------------- purchaser and product --
    let y = 60;

    sectionHeading(doc, "Purchaser", MARGIN, y, COLUMN);
    sectionHeading(doc, "Product", RIGHT_COLUMN_X, y, COLUMN);

    const afterParties = Math.max(
        fieldBlock(
            doc,
            [
                ["Name", customer.full_name],
                ["Father / Husband", customer.father_husband_name],
                ["CNIC", customer.cnic_number],
                ["Mobile", customer.mobile_number],
                ["Occupation", customer.occupation ?? ""],
                ["Address", customer.address],
            ],
            MARGIN,
            y + 5,
            COLUMN,
        ),
        fieldBlock(
            doc,
            [
                ["Description", contract.product_name],
                ["Condition", contract.product_condition],
                ["Agreement no.", reference(contract.id)],
                ["Delivered on", formatDate(contract.start_date)],
            ],
            RIGHT_COLUMN_X,
            y + 5,
            COLUMN,
        ),
    );

    // -------------------------------------------------------- guarantors --
    // FR-CUS-03-v2 as built: the second guarantor is optional (§2.7 item 4),
    // so the block is kept and left blank rather than dropped — the printed
    // form still has somewhere to write one in.
    const guarantorRows = (position: number): [string, string][] => {
        const person = guarantors.find((entry) => entry.position === position);

        return [
            ["Name", person?.full_name ?? ""],
            ["Father / Husband", person?.father_name ?? ""],
            ["Relationship", person?.relationship ?? ""],
            ["CNIC", person?.cnic_number ?? ""],
            ["Mobile", person?.mobile_number ?? ""],
            ["Address", person?.address ?? ""],
        ];
    };

    y = afterParties + 4;

    sectionHeading(doc, "Guarantor 1", MARGIN, y, COLUMN);
    sectionHeading(doc, "Guarantor 2", RIGHT_COLUMN_X, y, COLUMN);

    y = Math.max(
        fieldBlock(doc, guarantorRows(1), MARGIN, y + 5, COLUMN),
        fieldBlock(doc, guarantorRows(2), RIGHT_COLUMN_X, y + 5, COLUMN),
    );

    // ----------------------------------------------------- payment terms --
    const terms: [string, string][] = [
        ["Product price", pkr(contract.sale_price)],
        [`Markup (${contract.markup_pct}%)`, pkr(contract.markup_amount)],
        ["Total payable", pkr(contract.net_amount)],
        ["Down payment received", pkr(contract.down_payment)],
        ["Balance financed", pkr(contract.financed_amount)],
        ["Number of installments", String(contract.plan_months)],
        ["Monthly installment", pkr(contract.monthly_installment)],
        [
            "First installment due",
            formatDate(
                contract.installments[0]?.due_date ?? contract.start_date,
            ),
        ],
        ["Agreement date", formatDate(contract.start_date)],
        ["Final installment due", formatDate(contract.end_date)],
    ];

    y = sectionHeading(doc, "Payment terms", MARGIN, y + 4, right - MARGIN);

    y = Math.max(
        termsBlock(doc, terms.slice(0, 5), MARGIN, y, COLUMN),
        termsBlock(doc, terms.slice(5), RIGHT_COLUMN_X, y, COLUMN),
    );

    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
    doc.text("Total payable in words:", MARGIN, y + 2);

    doc.setFont("helvetica", "bold").setTextColor(...INK);
    doc.text(amountInWords(contract.net_amount), MARGIN + 30, y + 2);

    // ----------------------------------------------- installment schedule --
    // Down two columns rather than one long strip, so a twenty-month plan
    // still fits the page it started on.
    const half = Math.ceil(contract.installments.length / 2);
    const columns = [
        contract.installments.slice(0, half),
        contract.installments.slice(half),
    ];

    y = sectionHeading(doc, "Installment schedule", MARGIN, y + 8, right - MARGIN);

    const scheduleStart = y;
    let scheduleEnd = y;

    columns.forEach((column, index) => {
        if (column.length === 0) return;

        autoTable(doc, {
            startY: scheduleStart,
            theme: "grid",
            headStyles: {
                fillColor: HEAD_FILL,
                textColor: INK,
                fontSize: 6.5,
                fontStyle: "bold",
                lineColor: [51, 65, 85],
                lineWidth: 0.1,
            },
            styles: {
                fontSize: 6.5,
                textColor: INK,
                cellPadding: 1,
                lineColor: [51, 65, 85],
                lineWidth: 0.1,
            },
            columnStyles: {
                0: { cellWidth: 7 },
                1: { cellWidth: 17 },
                2: { halign: "right", fontStyle: "bold" },
                3: { halign: "right" },
                4: { cellWidth: 17 },
            },
            head: [["#", "Due date", "Amount", "Received", "Paid on"]],
            body: column.map((row) => {
                const paid = received.get(row.seq);

                return [
                    String(row.seq),
                    formatDate(row.due_date),
                    pkr(row.amount),
                    // Both cells stay empty until money is applied, so a fresh
                    // agreement still prints a grid to fill in by hand.
                    paid ? pkr(paid.amount) : "",
                    paid?.completed_on ? formatDate(paid.completed_on) : "",
                ];
            }),
            margin:
                index === 0
                    ? { left: MARGIN, right: MARGIN + COLUMN + GUTTER }
                    : { left: RIGHT_COLUMN_X, right: MARGIN },
        });

        scheduleEnd = Math.max(scheduleEnd, doc.lastAutoTable?.finalY ?? y);
    });

    y = scheduleEnd;

    // ------------------------------------------------ terms and conditions --
    // A heading with two lines under it and the rest overleaf reads as an
    // error; 30mm is enough for the heading and a few clauses to follow it.
    if (y > height - FOOTER_RULE - 30) {
        doc.addPage();
        y = 20;
    }

    y = sectionHeading(doc, "Terms and conditions", MARGIN, y + 6, right - MARGIN);

    doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...INK);

    // Numbered down the left column, then the right — the same reading order
    // as the printed sheet's two-column list.
    const rendered = INVOICE_TERMS.map(
        (term, index) => `${index + 1}. ${renderTerm(term, business.name)}`,
    );

    const wrapped: string[][] = rendered.map((line) =>
        doc.splitTextToSize(line, COLUMN - 2),
    );

    const lineHeight = 2.6;
    /** The last baseline that still clears the footer rule. */
    const bottom = height - FOOTER_RULE - 4;
    /** A clause is a paragraph plus the gap to the next one. */
    const heightOf = (lines: string[]) => lines.length * lineHeight + 0.8;

    let top = y;
    let cursor = top;
    let column = 0;
    let afterTerms = top;

    // Lines still to place, so the halfway point can be recomputed after a
    // page break rather than measured once against the whole list.
    let remaining = wrapped.reduce((sum, lines) => sum + lines.length, 0);
    let halfway = remaining / 2;
    let placed = 0;

    for (const lines of wrapped) {
        const overflows = cursor + lines.length * lineHeight > bottom;

        // Break to the second column at the halfwayway mark, measured in lines
        // rather than clauses: they are not the same length, and splitting by
        // count leaves one column halfway empty. A column that fills early
        // breaks anyway, and a second full column starts a page.
        if (column === 0 && (placed >= halfway || overflows)) {
            column = 1;
            cursor = top;
        } else if (column === 1 && overflows) {
            doc.addPage();
            doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...INK);
            top = 20;
            cursor = top;
            column = 0;
            placed = 0;
            halfway = remaining / 2;
            // Depth is per page: keeping the previous page's would push the
            // signatures onto a page of their own for no reason.
            afterTerms = top;
        }

        doc.text(lines, column === 0 ? MARGIN : RIGHT_COLUMN_X, cursor);

        cursor += heightOf(lines);
        placed += lines.length;
        remaining -= lines.length;
        afterTerms = Math.max(afterTerms, cursor);
    }


    // ------------------------------------------------------- signatures --
    let signY = afterTerms + 8;

    // The whole block moves or none of it does: a rule on one page with the
    // names on the next is not something anybody can sign.
    if (signY + SIGNATURE_HEIGHT > height - FOOTER_RULE - 2) {
        doc.addPage();
        signY = 30;
    }

    const third = (right - MARGIN - GUTTER * 2) / 3;

    (
        [
            ["Purchaser", customer.full_name],
            [
                "Guarantor",
                guarantors.find((entry) => entry.position === 1)?.full_name ?? "",
            ],
            [`For ${business.name}`, ""],
        ] as [string, string][]
    ).forEach(([role, name], index) => {
        const x = MARGIN + index * (third + GUTTER);

        doc.setDrawColor(...MUTED).setLineWidth(0.2);
        doc.line(x, signY, x + third, signY);

        doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...INK);
        doc.text(role, x, signY + 4);

        doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...MUTED);
        doc.text(name || "Name and signature", x, signY + 7.5);
    });

    // ----------------------------------------------------------- footer --
    const pages = doc.getNumberOfPages();

    for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);

        doc.setDrawColor(...RULE).setLineWidth(0.2);
        doc.line(MARGIN, height - 12, right, height - 12);

        doc.setFont("helvetica", "normal").setFontSize(6).setTextColor(...MUTED);
        doc.text(
            `${reference(contract.id)} · Generated ${formatDate(invoice.issued_at)} · Issued by ${business.name} and valid without a company seal.`,
            MARGIN,
            height - 8,
        );
        doc.text(`Page ${page} of ${pages}`, right, height - 8, {
            align: "right",
        });
    }

    return doc;
}

export function downloadInvoicePdf(invoice: Invoice): void {
    buildInvoicePdf(invoice).save(invoiceFileName(invoice));
}
