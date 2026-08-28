import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatDate } from "./format";
import type { Summary, SummaryRow } from "@/types/report";

/**
 * FR-SUM-08. The workbook as a PDF, and as tab-separated text for a
 * spreadsheet.
 *
 * Built from the report data rather than captured from the screen, for the
 * same reasons as the recovery ledger: selectable text, a small file, and the
 * same document whatever appearance the viewer is using.
 *
 * Landscape, because eleven columns do not fit portrait at a readable size.
 */

const NAVY: [number, number, number] = [19, 54, 94];
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const MARGIN = 12;

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? money.format(amount) : value;
}

/** The columns, in the order the workbook shows them. */
const COLUMNS: { header: string; cell: (row: SummaryRow) => string }[] = [
    { header: "Client", cell: (row) => row.customer_name },
    { header: "Mobile", cell: (row) => row.customer_mobile },
    { header: "Deal type", cell: (row) => row.deal_type },
    { header: "Product", cell: (row) => row.product_name },
    { header: "Sale", cell: (row) => pkr(row.sale_price) },
    { header: "Markup", cell: (row) => pkr(row.markup_amount) },
    { header: "Markup %", cell: (row) => row.actual_markup_pct },
    { header: "Total", cell: (row) => pkr(row.total_sale) },
    { header: "Down", cell: (row) => pkr(row.down_payment) },
    { header: "Financed", cell: (row) => pkr(row.rem_balance) },
    { header: "Paid", cell: (row) => pkr(row.paid) },
    { header: "Outstanding", cell: (row) => pkr(row.outstanding) },
    { header: "%", cell: (row) => row.pct_completed },
    { header: "Score", cell: (row) => row.score },
];

function safeFilePart(value: string): string {
    return value
        .normalize("NFKD")
        .replace(/[^\w\s.-]/g, "")
        .trim()
        .replace(/[\s.]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-|-$/g, "");
}

export function summaryFileName(summary: Summary): string {
    return `SPS-Summary-${safeFilePart(formatDate(summary.generated_at))}.pdf`;
}

export function buildSummaryPdf(summary: Summary, rows: SummaryRow[]): jsPDF {
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
    const right = doc.internal.pageSize.getWidth() - MARGIN;
    const { totals } = summary;

    doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...NAVY);
    doc.text("SmartPay Solutions", MARGIN, 15);

    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    doc.text("Internal summary report", MARGIN, 20);
    doc.text(`Generated ${formatDate(summary.generated_at)}`, right, 15, {
        align: "right",
    });
    doc.text(
        `${rows.length} of ${totals.deals} deal${totals.deals === 1 ? "" : "s"}`,
        right,
        20,
        { align: "right" },
    );

    doc.setDrawColor(...NAVY).setLineWidth(0.5);
    doc.line(MARGIN, 23, right, 23);

    // The headline figures, so the sheet stands on its own away from the app.
    autoTable(doc, {
        startY: 27,
        theme: "grid",
        headStyles: {
            fillColor: NAVY,
            textColor: [255, 255, 255],
            fontSize: 7,
            halign: "center",
        },
        styles: { fontSize: 8, halign: "center", textColor: INK },
        head: [
            [
                "Deals",
                "Completed",
                "Written",
                "Collected",
                "Outstanding",
                "Mature profit",
                "Unmatured",
                "Avg markup",
                "Net balance",
            ],
        ],
        body: [
            [
                String(totals.deals),
                String(totals.completed),
                pkr(totals.total_sale),
                pkr(totals.total_paid),
                pkr(totals.total_outstanding),
                pkr(totals.mature_profit),
                pkr(totals.unmatured_profit),
                `${totals.average_markup_pct}%`,
                pkr(totals.net_balance),
            ],
        ],
        margin: { left: MARGIN, right: MARGIN },
    });

    autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY ?? 40) + 5,
        theme: "grid",
        headStyles: {
            fillColor: NAVY,
            textColor: [255, 255, 255],
            fontSize: 7,
        },
        styles: { fontSize: 7, textColor: INK, cellPadding: 1.2 },
        // Money reads right-aligned; the first four columns are text.
        columnStyles: Object.fromEntries(
            COLUMNS.map((column, index) => [
                index,
                { halign: index >= 4 ? ("right" as const) : ("left" as const) },
            ]),
        ),
        head: [COLUMNS.map((column) => column.header)],
        body: rows.map((row) => COLUMNS.map((column) => column.cell(row))),
        margin: { left: MARGIN, right: MARGIN },
    });

    const pages = doc.getNumberOfPages();

    for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
        doc.text(
            "SmartPay Solutions · internal · not for circulation",
            MARGIN,
            doc.internal.pageSize.getHeight() - 6,
        );
        doc.text(
            `Page ${page} of ${pages}`,
            right,
            doc.internal.pageSize.getHeight() - 6,
            { align: "right" },
        );
    }

    return doc;
}

export function downloadSummaryPdf(summary: Summary, rows: SummaryRow[]): void {
    buildSummaryPdf(summary, rows).save(summaryFileName(summary));
}

/**
 * FR-SUM-08. Tab-separated rather than comma: a spreadsheet pastes TSV
 * straight into cells, and no field here needs quoting or escaping.
 */
export function summaryAsText(rows: SummaryRow[]): string {
    const header = COLUMNS.map((column) => column.header).join("\t");
    const body = rows.map((row) =>
        COLUMNS.map((column) => column.cell(row)).join("\t"),
    );

    return [header, ...body].join("\n");
}
