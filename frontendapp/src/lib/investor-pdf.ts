import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatDate } from "./format";
import { BUCKET_LABEL, type InvestorDetail } from "@/types/investor";

/**
 * FR-IVT-12. One investor's statement as a downloadable PDF.
 *
 * Built from the investor payload with jsPDF, the same way the ledger, the
 * agreement and the funding register are — vector text, a small file, and the
 * same document on every machine rather than a raster of one person's screen.
 *
 * Portrait A4: this is a statement to hand to the person whose money it is,
 * and the ledger has few enough columns to sit on a normal page.
 *
 * Every number comes from the payload the screen rendered, so the paper and
 * the page cannot disagree. Nothing is recomputed here.
 */

const NAVY: [number, number, number] = [19, 54, 94];
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const GREEN: [number, number, number] = [6, 118, 71];
const RED: [number, number, number] = [180, 35, 24];

const MARGIN = 14;

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

/**
 * Windows, macOS and Linux between them reject `\ / : * ? " < > |`, and a
 * trailing dot or space breaks Explorer.
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

/** `SPS-Investor-khan-11111-1111111-1-14-09-2026.pdf` */
export function investorFileName(investor: InvestorDetail): string {
    const parts = [
        "SPS-Investor",
        safeFilePart(investor.full_name) || `Investor-${investor.id}`,
        safeFilePart(investor.cnic_number),
        formatDate(new Date().toISOString()),
    ].filter(Boolean);

    return `${parts.join("-")}.pdf`;
}

/** A band of figures under a navy rule, the way the screen groups them. */
function band(
    doc: jsPDF,
    title: string,
    figures: [string, string][],
    y: number,
    width: number,
): number {
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...NAVY);
    doc.text(title.toUpperCase(), MARGIN, y, { charSpace: 0.3 });

    doc.setDrawColor(...NAVY).setLineWidth(0.3);
    doc.line(MARGIN, y + 1.6, MARGIN + width, y + 1.6);

    const column = width / figures.length;

    figures.forEach(([label, value], index) => {
        const x = MARGIN + index * column;

        doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...MUTED);
        doc.text(label.toUpperCase(), x, y + 7, { charSpace: 0.15 });

        doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...INK);
        doc.text(value, x, y + 13);
    });

    return y + 20;
}

export function buildInvestorPdf(
    investor: InvestorDetail,
    businessName = "SmartPay Solutions",
): jsPDF {
    const { balances, transactions } = investor;

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const right = width - MARGIN;
    const content = right - MARGIN;

    // ------------------------------------------------------- letterhead --
    doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...NAVY);
    doc.text(businessName, MARGIN, 18);

    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    doc.text("Investor statement", MARGIN, 23);

    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...INK);
    doc.text(investor.full_name, right, 17, { align: "right" });

    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
    doc.text(
        [investor.cnic_number, investor.mobile_number]
            .filter(Boolean)
            .join("  ·  "),
        right,
        22,
        { align: "right" },
    );
    doc.text(
        `${investor.status === "active" ? "Active" : "Inactive"}${
            investor.agreement_date
                ? `  ·  agreed ${formatDate(investor.agreement_date)}`
                : ""
        }`,
        right,
        26,
        { align: "right" },
    );

    doc.setDrawColor(...NAVY).setLineWidth(0.6);
    doc.line(MARGIN, 29, right, 29);

    // ---------------------------------------------------------- position --
    // The same four bands the screen shows, in the same order, so a reader
    // who knows one can read the other without translating.
    let y = band(
        doc,
        "Position",
        [
            ["Available", pkr(balances.available)],
            ["Deployed", pkr(balances.deployed)],
            // BR-31. Printed even at zero: a payable short of available plus
            // deployed with nothing to explain it reads as an arithmetic fault.
            ["Expenses charged", pkr(balances.expenses_charged)],
            ["Payable", pkr(balances.payable)],
        ],
        37,
        content,
    );

    y = band(
        doc,
        "Capital",
        [
            ["Net capital", pkr(balances.net_principal)],
            ["Idle", pkr(balances.principal_available)],
            ["Deployed", pkr(balances.principal_deployed)],
        ],
        y,
        content,
    );

    y = band(
        doc,
        "Profit",
        [
            ["Earned", pkr(balances.lifetime_profit)],
            ["Idle", pkr(balances.profit_available)],
            ["Deployed", pkr(balances.profit_deployed)],
        ],
        y,
        content,
    );

    y = band(
        doc,
        "Performance",
        [
            ["Return", `${balances.return_on_principal}%`],
            ["Turnover", `${balances.capital_turnover}x`],
            ["Growth", `${balances.cumulative_growth}%`],
        ],
        y,
        content,
    );

    // ------------------------------------------------------------ ledger --
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(...NAVY);
    doc.text("LEDGER", MARGIN, y + 2, { charSpace: 0.3 });

    doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...MUTED);
    doc.text(
        "Append-only. A mistake is corrected with an adjustment, never by editing a line.",
        MARGIN + 20,
        y + 2,
    );

    autoTable(doc, {
        startY: y + 5,
        theme: "grid",
        headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7 },
        styles: { fontSize: 7, textColor: INK, cellPadding: 1.4 },
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 20 },
            2: { cellWidth: 18 },
            3: { halign: "right", cellWidth: 26 },
            4: { cellWidth: 20 },
            5: {},
        },
        head: [["Date", "Type", "Bucket", "Amount", "Method", "Reference / reason"]],
        body: transactions.map((txn) => [
            formatDate(txn.txn_date),
            txn.type,
            BUCKET_LABEL[txn.bucket],
            // Withdrawals and losses are stored positive and subtracted, so
            // they print the way they read on the balance, not the way they
            // are stored.
            `${txn.type === "Withdrawal" || txn.type === "Loss" ? "- " : ""}${pkr(txn.amount)}`,
            txn.method ?? "—",
            txn.reason ?? txn.reference ?? "—",
        ]),
        didParseCell: (data) => {
            if (data.section !== "body" || data.column.index !== 3) return;

            const txn = transactions[data.row.index];

            if (!txn) return;

            if (txn.type === "Withdrawal" || txn.type === "Loss") {
                data.cell.styles.textColor = RED;
            } else if (txn.type === "Deposit") {
                data.cell.styles.textColor = GREEN;
            }
        },
        margin: { left: MARGIN, right: MARGIN },
    });

    if (transactions.length === 0) {
        doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
        doc.text(
            "Nothing recorded yet.",
            MARGIN,
            (doc.lastAutoTable?.finalY ?? y) + 6,
        );
    }

    // ----------------------------------------------------------- footer --
    const pages = doc.getNumberOfPages();

    for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...MUTED);
        doc.text(
            `${investor.full_name} · every figure derived from the ledger above · generated ${formatDate(new Date().toISOString())}`,
            MARGIN,
            height - 8,
        );
        doc.text(`Page ${page} of ${pages}`, right, height - 8, {
            align: "right",
        });
    }

    return doc;
}

export function downloadInvestorPdf(
    investor: InvestorDetail,
    businessName?: string,
): void {
    buildInvestorPdf(investor, businessName).save(investorFileName(investor));
}
