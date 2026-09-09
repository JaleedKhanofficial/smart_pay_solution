import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatDate } from "./format";
import type {
    FundingFilterValues,
    FundingReport,
} from "@/types/funding-report";

/**
 * FR-IVT-16. The funding register as a downloadable PDF.
 *
 * Built from the report data with jsPDF, the same way the recovery ledger and
 * the agreement are — vector text, a small file, and the same document on
 * every machine, rather than a raster of whatever the screen happened to show.
 *
 * jsPDF works in millimetres on A4 here, so every number below is a millimetre.
 * Landscape, because this table is wide: a deal, its investors and six money
 * columns do not fit a portrait page without shrinking the type past reading.
 */

const NAVY: [number, number, number] = [19, 54, 94];
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const GREEN: [number, number, number] = [6, 118, 71];

const MARGIN = 12;

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

/** `SPS-Funding-Register-joint-09-09-2026.pdf` */
export function fundingReportFileName(
    report: FundingReport,
    filters: FundingFilterValues,
): string {
    const parts = [
        "SPS-Funding-Register",
        filters.arrangement ? safeFilePart(filters.arrangement) : "",
        formatDate(report.generated_at),
    ].filter(Boolean);

    return `${parts.join("-")}.pdf`;
}

/** The filters in words, so a printed copy says what it is a copy of. */
function describeFilters(filters: FundingFilterValues): string {
    const said: string[] = [];

    if (filters.arrangement) {
        said.push(
            filters.arrangement === "sole"
                ? "sole-funded only"
                : "jointly funded only",
        );
    }

    if (filters.status) said.push(`status ${filters.status}`);
    if (filters.search) said.push(`matching "${filters.search}"`);

    return said.length > 0
        ? `Filtered: ${said.join(" · ")}`
        : "Every funded contract";
}

export function buildFundingReportPdf(
    report: FundingReport,
    filters: FundingFilterValues,
    businessName = "SmartPay Solutions",
): jsPDF {
    const { rows, investors, totals } = report;

    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const right = width - MARGIN;

    // ------------------------------------------------------- letterhead --
    doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...NAVY);
    doc.text(businessName, MARGIN, 16);

    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    doc.text("Funding register", MARGIN, 21);

    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...INK);
    doc.text(describeFilters(filters), right, 16, { align: "right" });

    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
    doc.text(`Generated ${formatDate(report.generated_at)}`, right, 21, {
        align: "right",
    });

    doc.setDrawColor(...NAVY).setLineWidth(0.6);
    doc.line(MARGIN, 24, right, 24);

    // ----------------------------------------------------------- totals --
    autoTable(doc, {
        startY: 28,
        theme: "plain",
        styles: { fontSize: 8, cellPadding: 1, textColor: INK },
        columnStyles: {
            0: { cellWidth: 30, textColor: MUTED, fontSize: 7 },
            1: { fontStyle: "bold", cellWidth: 40 },
            2: { cellWidth: 30, textColor: MUTED, fontSize: 7 },
            3: { fontStyle: "bold", cellWidth: 40 },
            4: { cellWidth: 30, textColor: MUTED, fontSize: 7 },
            5: { fontStyle: "bold" },
        },
        body: [
            [
                "Funded contracts",
                `${totals.contracts}  (${totals.sole} sole · ${totals.joint} joint)`,
                "Capital deployed",
                pkr(totals.funded),
                "Investors",
                String(totals.investors),
            ],
            [
                "Capital recovered",
                pkr(totals.capital_recovered),
                "Still out",
                pkr(totals.capital_outstanding),
                "Profit earned",
                `${pkr(totals.matured_profit)}   (${pkr(totals.unmatured_profit)} to come)`,
            ],
        ],
        margin: { left: MARGIN, right: MARGIN },
    });

    // -------------------------------------------------------- by contract --
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...NAVY);
    doc.text("By contract", MARGIN, (doc.lastAutoTable?.finalY ?? 40) + 7);

    autoTable(doc, {
        startY: (doc.lastAutoTable?.finalY ?? 40) + 10,
        theme: "grid",
        headStyles: {
            fillColor: NAVY,
            textColor: [255, 255, 255],
            fontSize: 7,
        },
        styles: { fontSize: 7, textColor: INK, cellPadding: 1.4 },
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 38 },
            2: { cellWidth: 18 },
            3: { halign: "right", cellWidth: 24 },
            4: { cellWidth: 70 },
            5: { halign: "right", cellWidth: 24 },
            6: { halign: "right", cellWidth: 24 },
            7: { halign: "right" },
        },
        head: [
            [
                "Contract",
                "Customer",
                "Raised",
                "Cost",
                "Investors",
                "Recovered",
                "Still out",
                "Profit",
            ],
        ],
        body: rows.map((row) => [
            `${row.reference}\n${row.status}${row.deleted ? " · in bin" : ""}`,
            `${row.customer_name}\n${row.product_name}`,
            row.arrangement === "joint"
                ? `Joint · ${row.investor_count}`
                : "Sole",
            pkr(row.cost_price),
            // One investor per line inside the cell, so a joint deal reads as
            // the several stakes it is rather than one run-on string.
            row.stakes
                .map(
                    (stake) =>
                        `${stake.investor_name}  ${pkr(stake.amount)} (${stake.share_pct}%)`,
                )
                .join("\n"),
            pkr(row.capital_recovered),
            pkr(row.capital_outstanding),
            pkr(row.matured_profit),
        ]),
        didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 7) {
                const row = rows[data.row.index];

                if (row && Number(row.matured_profit) > 0) {
                    data.cell.styles.textColor = GREEN;
                    data.cell.styles.fontStyle = "bold";
                }
            }
        },
        margin: { left: MARGIN, right: MARGIN },
    });

    // -------------------------------------------------------- by investor --
    if (investors.length > 0) {
        const after = (doc.lastAutoTable?.finalY ?? 60) + 7;

        // A heading with nothing under it reads as an error; start the block
        // on a fresh page when the table it introduces cannot follow it.
        if (after > height - 40) doc.addPage();

        const headingY = after > height - 40 ? 20 : after;

        doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...NAVY);
        doc.text("By investor", MARGIN, headingY);

        autoTable(doc, {
            startY: headingY + 3,
            theme: "grid",
            headStyles: {
                fillColor: NAVY,
                textColor: [255, 255, 255],
                fontSize: 7,
            },
            styles: { fontSize: 7, textColor: INK, cellPadding: 1.4 },
            columnStyles: {
                0: { cellWidth: 45 },
                1: { cellWidth: 40 },
                2: { halign: "right" },
                3: { halign: "right" },
                4: { halign: "right" },
                5: { halign: "right" },
            },
            head: [
                [
                    "Investor",
                    "Deals",
                    "Funded",
                    "Recovered",
                    "Still out",
                    "Profit",
                ],
            ],
            body: investors.map((investor) => [
                investor.investor_name,
                `${investor.contracts} · ${investor.sole} sole, ${investor.joint} joint`,
                pkr(investor.funded),
                pkr(investor.capital_recovered),
                pkr(investor.capital_outstanding),
                pkr(investor.matured_profit),
            ]),
            margin: { left: MARGIN, right: MARGIN },
        });
    }

    // ----------------------------------------------------------- footer --
    const pages = doc.getNumberOfPages();

    for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
        doc.text(
            `${businessName} · Funding register · every figure derived from the funding rows and the payments`,
            MARGIN,
            height - 7,
        );
        doc.text(`Page ${page} of ${pages}`, right, height - 7, {
            align: "right",
        });
    }

    return doc;
}

export function downloadFundingReportPdf(
    report: FundingReport,
    filters: FundingFilterValues,
    businessName?: string,
): void {
    buildFundingReportPdf(report, filters, businessName).save(
        fundingReportFileName(report, filters),
    );
}
