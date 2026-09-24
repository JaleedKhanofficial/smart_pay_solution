import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatDate } from "./format";
import type { InvestorFilterValues, InvestorRow } from "@/types/investor";

/**
 * FR-IVT-01. The investor register as a downloadable PDF.
 *
 * Built from the register data with jsPDF, the same way every other document
 * in this system is — vector text, a small file, and the same page on every
 * machine rather than a raster of one person's screen.
 *
 * Landscape A4: six money columns beside a name do not fit portrait without
 * shrinking the type past reading.
 */

const NAVY: [number, number, number] = [19, 54, 94];
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];

const MARGIN = 12;

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string): string {
    const amount = Number(value);

    return Number.isFinite(amount) ? `Rs. ${money.format(amount)}` : value;
}

function safeFilePart(value: string): string {
    return value
        .normalize("NFKD")
        .replace(/[^\w\s.-]/g, "")
        .trim()
        .replace(/[\s.]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-|-$/g, "");
}

/** `SPS-Investor-Register-active-14-09-2026.pdf` */
export function investorRegisterFileName(
    filters: InvestorFilterValues,
): string {
    const parts = [
        "SPS-Investor-Register",
        filters.status ? safeFilePart(filters.status) : "",
        formatDate(new Date().toISOString()),
    ].filter(Boolean);

    return `${parts.join("-")}.pdf`;
}

/** The filters in words, so a printed copy says what it is a copy of. */
function describeFilters(
    filters: InvestorFilterValues,
    investorName?: string,
): string {
    const said: string[] = [];

    if (investorName) said.push(investorName);
    if (filters.status) said.push(`${filters.status} only`);
    if (filters.search) said.push(`matching "${filters.search}"`);

    return said.length > 0 ? `Filtered: ${said.join(" · ")}` : "Every investor";
}

export function buildInvestorRegisterPdf(
    rows: InvestorRow[],
    filters: InvestorFilterValues,
    businessName = "SmartPay Solutions",
    /** Set when the export could not reach every matching row. */
    omitted = 0,
): jsPDF {
    const doc = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "landscape",
    });

    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const right = width - MARGIN;

    const sum = (pick: (row: InvestorRow) => string) =>
        rows.reduce((total, row) => total + Number(pick(row)), 0).toFixed(2);

    // The picked investor's own name reads better than their id on paper.
    const picked = filters.investor_id
        ? rows.find((row) => String(row.id) === filters.investor_id)?.full_name
        : undefined;

    // ------------------------------------------------------- letterhead --
    doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...NAVY);
    doc.text(businessName, MARGIN, 16);

    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    doc.text("Investor register", MARGIN, 21);

    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...INK);
    doc.text(describeFilters(filters, picked), right, 16, { align: "right" });

    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
    doc.text(
        `Generated ${formatDate(new Date().toISOString())}`,
        right,
        21,
        { align: "right" },
    );

    doc.setDrawColor(...NAVY).setLineWidth(0.6);
    doc.line(MARGIN, 24, right, 24);

    // ----------------------------------------------------------- totals --
    autoTable(doc, {
        startY: 28,
        theme: "plain",
        styles: { fontSize: 8, cellPadding: 1, textColor: INK },
        columnStyles: {
            0: { cellWidth: 26, textColor: MUTED, fontSize: 7 },
            1: { fontStyle: "bold", cellWidth: 38 },
            2: { cellWidth: 26, textColor: MUTED, fontSize: 7 },
            3: { fontStyle: "bold", cellWidth: 38 },
            4: { cellWidth: 26, textColor: MUTED, fontSize: 7 },
            5: { fontStyle: "bold" },
        },
        body: [
            [
                "Investors",
                String(rows.length),
                "Net capital",
                pkr(sum((row) => row.net_principal)),
                "Profit earned",
                pkr(sum((row) => row.lifetime_profit)),
            ],
            [
                "Idle",
                pkr(sum((row) => row.available)),
                "Deployed",
                pkr(sum((row) => row.deployed)),
                "Expenses",
                pkr(sum((row) => row.expenses_charged)),
            ],
            [
                "Payable",
                pkr(sum((row) => row.payable)),
                "",
                "",
                "",
                "",
            ],
        ],
        margin: { left: MARGIN, right: MARGIN },
    });

    // --------------------------------------------------------- the rows --
    autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY ?? 40) + 5,
        theme: "grid",
        headStyles: {
            fillColor: NAVY,
            textColor: [255, 255, 255],
            fontSize: 7,
        },
        styles: { fontSize: 7, textColor: INK, cellPadding: 1.4 },
        columnStyles: {
            0: { cellWidth: 12 },
            1: { cellWidth: 46 },
            2: { cellWidth: 34 },
            3: { cellWidth: 26 },
            4: { halign: "right" },
            5: { halign: "right" },
            6: { halign: "right" },
            7: { halign: "right" },
            8: { halign: "right" },
            9: { halign: "right" },
        },
        head: [
            [
                "Sr #",
                "Investor",
                "CNIC",
                "Mobile",
                "Net capital",
                "Profit",
                "Idle",
                "Deployed",
                // BR-31. Between deployed and payable, because that is where
                // the difference between the two comes from.
                "Expenses",
                "Payable",
            ],
        ],
        body: rows.map((row, index) => [
            String(index + 1),
            `${row.full_name}${row.status === "inactive" ? "  (inactive)" : ""}`,
            row.cnic_number,
            row.mobile_number,
            pkr(row.net_principal),
            pkr(row.lifetime_profit),
            pkr(row.available),
            pkr(row.deployed),
            pkr(row.expenses_charged),
            pkr(row.payable),
        ]),
        margin: { left: MARGIN, right: MARGIN },
    });

    if (rows.length === 0) {
        doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
        doc.text(
            "No investor matches these filters.",
            MARGIN,
            (doc.lastAutoTable?.finalY ?? 50) + 6,
        );
    }

    // ----------------------------------------------------------- footer --
    const pages = doc.getNumberOfPages();

    for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...MUTED);
        doc.text(
            omitted > 0
                ? // Said plainly rather than left for the reader to notice a
                  // total that does not match their screen.
                  `${businessName} · investor register · ${omitted} further investor${omitted === 1 ? "" : "s"} matched but are not on this copy`
                : `${businessName} · investor register · every figure derived from the ledgers`,
            MARGIN,
            height - 7,
        );
        doc.text(`Page ${page} of ${pages}`, right, height - 7, {
            align: "right",
        });
    }

    return doc;
}

export function downloadInvestorRegisterPdf(
    rows: InvestorRow[],
    filters: InvestorFilterValues,
    businessName?: string,
    omitted?: number,
): void {
    buildInvestorRegisterPdf(rows, filters, businessName, omitted).save(
        investorRegisterFileName(filters),
    );
}
