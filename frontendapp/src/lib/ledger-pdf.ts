import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatDate } from "./format";
import type { Ledger } from "@/types/ledger";

/**
 * FR-REC-07. The recovery ledger as a downloadable PDF.
 *
 * Drawn from the ledger **data**, not captured from the screen. A DOM capture
 * would produce a blurry raster whose text cannot be selected or searched, at
 * several megabytes, and it would inherit whatever appearance the viewer had
 * chosen — the very fault that made the first printed copy come out blank.
 * Building from the data gives crisp vector text, a small file, and the same
 * document on every machine.
 *
 * jsPDF works in millimetres on A4 here, so every number below is a millimetre.
 */

/**
 * `autoTable` writes where it finished onto the document so the next block can
 * start below it, but ships no types for that. Declaring it here is honest
 * about the shape rather than casting the document to `any` at each use.
 */
declare module "jspdf" {
    interface jsPDF {
        lastAutoTable?: { finalY?: number };
    }
}

const NAVY: [number, number, number] = [19, 54, 94];
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const RULE: [number, number, number] = [203, 213, 225];
const RED: [number, number, number] = [180, 35, 24];
const GREEN: [number, number, number] = [6, 118, 71];

const MARGIN = 14;

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
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

/** `SPS-Recovery-Jaleed-Khan-17202-0421424-1-26-08-2026.pdf` */
export function ledgerFileName(ledger: Ledger): string {
    const { customer_name, customer_cnic } = ledger.contract;

    const parts = [
        "SPS-Recovery",
        safeFilePart(customer_name) || `Contract-${ledger.contract.id}`,
        safeFilePart(customer_cnic),
        formatDate(ledger.generated_at),
    ].filter(Boolean);

    return `${parts.join("-")}.pdf`;
}

export function buildLedgerPdf(ledger: Ledger): jsPDF {
    const { contract, summary, tier, rows, distribution } = ledger;

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const width = doc.internal.pageSize.getWidth();
    const right = width - MARGIN;

    // ------------------------------------------------------- letterhead --
    doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...NAVY);
    doc.text("SmartPay Solutions", MARGIN, 18);

    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    doc.text("Easy Monthly Installments", MARGIN, 23);

    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...NAVY);
    doc.text("RECOVERY LEDGER", right, 18, { align: "right" });

    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    doc.text(
        `Generated ${formatDate(ledger.generated_at)}`,
        right,
        23,
        { align: "right" },
    );

    doc.setDrawColor(...NAVY).setLineWidth(0.6);
    doc.line(MARGIN, 26, right, 26);

    // --------------------------------------------------------- customer --
    autoTable(doc, {
        startY: 31,
        theme: "plain",
        styles: { fontSize: 9, cellPadding: 1, textColor: INK },
        columnStyles: {
            0: { cellWidth: 26, textColor: MUTED, fontSize: 8 },
            1: { fontStyle: "bold" },
            2: { cellWidth: 26, textColor: MUTED, fontSize: 8 },
            3: { fontStyle: "bold" },
        },
        body: [
            [
                "Customer",
                contract.customer_name,
                "Agreement",
                `SPS-${String(contract.id).padStart(4, "0")}`,
            ],
            [
                "CNIC",
                contract.customer_cnic,
                "Product",
                contract.product_name,
            ],
            [
                "Term",
                `${formatDate(contract.start_date)} to ${formatDate(contract.end_date)}`,
                "Plan",
                `${summary.plan_months} monthly installments`,
            ],
        ],
        margin: { left: MARGIN, right: MARGIN },
    });

    // ---------------------------------------------------------- summary --
    autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY ?? 45) + 4,
        theme: "grid",
        headStyles: {
            fillColor: NAVY,
            textColor: [255, 255, 255],
            fontSize: 8,
            halign: "center",
        },
        styles: { fontSize: 9, halign: "center", textColor: INK },
        head: [
            [
                "Recovered",
                "Total payable",
                "Down payment",
                "Financed",
                "Paid to date",
                "Outstanding",
            ],
        ],
        body: [
            [
                `${summary.recovered_pct}%`,
                pkr(summary.total_payable),
                pkr(summary.down_payment),
                pkr(summary.financed_amount),
                pkr(summary.total_paid),
                pkr(summary.outstanding),
            ],
        ],
        margin: { left: MARGIN, right: MARGIN },
    });

    // --------------------------------------------- tier and punctuality --
    const afterSummary = (doc.lastAutoTable?.finalY ?? 60) + 6;

    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...NAVY);
    doc.text("Loyalty tier", MARGIN, afterSummary);

    doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(...INK);
    doc.text(tier.label, MARGIN, afterSummary + 7);

    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    // The behaviour line is prose and will not fit one column unwrapped.
    doc.text(doc.splitTextToSize(tier.behaviour, 78), MARGIN, afterSummary + 12);

    const lag = summary.net_days;
    const lagText =
        summary.completed_installments === 0
            ? "No installment completed yet"
            : lag > 0
              ? `Net lag of ${lag} day${lag === 1 ? "" : "s"}`
              : lag < 0
                ? `Net advance of ${Math.abs(lag)} day${lag === -1 ? "" : "s"}`
                : "Running exactly to schedule";

    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...NAVY);
    doc.text("Punctuality", MARGIN + 92, afterSummary);

    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.setTextColor(...(lag > 0 ? RED : GREEN));
    doc.text(lagText, MARGIN + 92, afterSummary + 7);

    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);

    // Only the bands that actually occurred; six empty rows say nothing.
    const bands = distribution.filter((entry) => entry.count > 0);

    doc.text(
        bands.length === 0
            ? "No completed installments to grade."
            : bands
                  .map((entry) => `${entry.label}: ${entry.count}`)
                  .join("   ·   "),
        MARGIN + 92,
        afterSummary + 12,
        { maxWidth: 88 },
    );

    // ----------------------------------------------------- month by month --
    autoTable(doc, {
        startY: afterSummary + 24,
        theme: "grid",
        headStyles: {
            fillColor: NAVY,
            textColor: [255, 255, 255],
            fontSize: 8,
        },
        styles: { fontSize: 8, textColor: INK, lineColor: RULE },
        columnStyles: {
            0: { cellWidth: 10, halign: "right" },
            2: { halign: "right" },
            3: { halign: "right" },
            5: { halign: "right", cellWidth: 14 },
        },
        head: [
            [
                "#",
                "Due",
                "Required",
                "Applied",
                "Completed",
                "Days",
                "Status",
                "Punctuality",
            ],
        ],
        body: rows.map((row) => [
            String(row.seq),
            formatDate(row.due_date),
            pkr(row.required),
            pkr(row.applied),
            row.completed_on ? formatDate(row.completed_on) : "—",
            row.days_late === null
                ? "—"
                : `${row.days_late > 0 ? "+" : ""}${row.days_late}`,
            row.status,
            row.band_label ?? "—",
        ]),
        // Late rows are the ones a collector is looking for, so they carry the
        // colour rather than every row being striped for decoration.
        didParseCell: (data) => {
            if (data.section !== "body") return;

            const row = rows[data.row.index];

            if (data.column.index === 5 && row.days_late !== null) {
                data.cell.styles.textColor = row.days_late > 0 ? RED : GREEN;
            }

            if (data.column.index === 6 && row.status === "Short Paid") {
                data.cell.styles.textColor = RED;
            }
        },
        margin: { left: MARGIN, right: MARGIN },
    });

    // ------------------------------------------------------------ footer --
    const pages = doc.getNumberOfPages();

    for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
        doc.text(
            `SPS-${String(contract.id).padStart(4, "0")} · ${contract.customer_name} · ${contract.customer_cnic}`,
            MARGIN,
            doc.internal.pageSize.getHeight() - 8,
        );
        doc.text(
            `Page ${page} of ${pages}`,
            right,
            doc.internal.pageSize.getHeight() - 8,
            { align: "right" },
        );
    }

    return doc;
}

export function downloadLedgerPdf(ledger: Ledger): void {
    buildLedgerPdf(ledger).save(ledgerFileName(ledger));
}
