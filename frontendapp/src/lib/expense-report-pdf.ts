import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatDate } from "./format";
import type { Expense, ExpensePeriod, ExpenseReport } from "@/types/expense";

/**
 * BR-31. The expense report as a downloadable PDF.
 *
 * The same three parts the screen shows, in the same order: each common period
 * as a plain list with its total and the share per investor, the individual
 * expenses under the investor they belong to, and the summary.
 *
 * jsPDF works in millimetres on A4 here, so every number below is a millimetre.
 */

const NAVY: [number, number, number] = [19, 54, 94];
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [100, 116, 139];
const SHADE: [number, number, number] = [241, 245, 249];

const MARGIN = 14;

const money = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });

function pkr(value: string | number): string {
    const amount = Number(value);

    return Number.isFinite(amount)
        ? `Rs. ${money.format(amount)}`
        : String(value);
}

/** `SPS-Expenses-15-09-2026.pdf` */
export function expenseReportFileName(report: ExpenseReport): string {
    return `SPS-Expenses-${formatDate(report.generated_at)}.pdf`;
}

const byDate = (a: Expense, b: Expense) =>
    a.spent_on.localeCompare(b.spent_on) || a.id - b.id;

export function buildExpenseReportPdf(
    report: ExpenseReport,
    expenses: Expense[],
    periods: ExpensePeriod[],
    businessName = "SmartPay Solutions"
): jsPDF {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    const right = width - MARGIN;

    // ------------------------------------------------------- letterhead --
    doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...NAVY);
    doc.text(businessName, MARGIN, 16);

    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...MUTED);
    doc.text("Expense report", MARGIN, 21);

    doc.setFontSize(7.5);
    doc.text(`Generated ${formatDate(report.generated_at)}`, right, 16, {
        align: "right",
    });

    doc.setDrawColor(...NAVY).setLineWidth(0.6);
    doc.line(MARGIN, 24, right, 24);

    let y = 32;

    /** A section title, moved to a fresh page when its table cannot follow. */
    const heading = (title: string, note?: string) => {
        if (y > height - 45) {
            doc.addPage();
            y = 20;
        }

        doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...NAVY);
        doc.text(title, MARGIN, y);

        if (note) {
            doc.setFont("helvetica", "normal")
                .setFontSize(7.5)
                .setTextColor(...MUTED);
            doc.text(note, right, y, { align: "right" });
        }

        y += 3;
    };

    const tableStyle = {
        theme: "grid" as const,
        headStyles: {
            fillColor: NAVY,
            textColor: [255, 255, 255] as [number, number, number],
            fontSize: 7.5,
        },
        footStyles: {
            fillColor: SHADE,
            textColor: INK,
            fontStyle: "bold" as const,
            fontSize: 7.5,
        },
        styles: { fontSize: 7.5, textColor: INK, cellPadding: 1.6 },
        margin: { left: MARGIN, right: MARGIN },
        // The totals belong under the last row, not repeated on every page.
        showFoot: "lastPage" as const,
    };

    // ----------------------------------------------------------- common --
    for (const period of periods) {
        const rows = expenses
            .filter(
                (row) => row.kind === "common" && row.period_id === period.id
            )
            .sort(byDate);

        const waived = period.members.filter((member) => member.waived).length;

        heading(
            `${period.label} expenses`,
            `${formatDate(period.starts_on)}${
                period.ends_on
                    ? ` to ${formatDate(period.ends_on)}`
                    : " onwards"
            }`
        );

        autoTable(doc, {
            ...tableStyle,
            startY: y,
            columnStyles: {
                0: { cellWidth: 12 },
                1: { cellWidth: 26 },
                3: { halign: "right", cellWidth: 32 },
            },
            head: [["Sr #", "Date", "Description", "Amount"]],
            body:
                rows.length > 0
                    ? rows.map((row, index) => [
                          String(index + 1),
                          formatDate(row.spent_on),
                          row.remarks
                              ? `${row.description}\n${row.remarks}`
                              : row.description,
                          pkr(row.amount),
                      ])
                    : [["", "", "Nothing recorded in this period.", ""]],
            foot: [
                ["", "", "Total", pkr(period.total)],
                [
                    "",
                    "",
                    `Per investor (divided by ${period.members.length}${
                        waived > 0 ? `, ${waived} waived` : ""
                    })`,
                    period.members.length > 0
                        ? pkr(period.per_member)
                        : "no members",
                ],
            ],
            didParseCell: (data) => {
                if (data.section === "foot" && data.column.index === 3) {
                    data.cell.styles.halign = "right";
                }
            },
        });

        y = (doc.lastAutoTable?.finalY ?? y) + 10;
    }

    // ------------------------------------------------------- individual --
    const individual = expenses
        .filter((row) => row.kind === "individual")
        .sort(byDate);

    const investorIds = [
        ...new Set(individual.map((row) => row.investor_id ?? 0)),
    ];

    heading("Individual expenses");

    const individualBody: string[][] = [];
    const subtotalRows = new Set<number>();

    for (const investorId of investorIds) {
        const rows = individual.filter(
            (row) => (row.investor_id ?? 0) === investorId
        );

        rows.forEach((row, index) => {
            individualBody.push([
                String(index + 1),
                formatDate(row.spent_on),
                row.investor_name ?? "",
                row.remarks
                    ? `${row.description}\n${row.remarks}`
                    : row.description,
                pkr(row.amount),
            ]);
        });

        subtotalRows.add(individualBody.length);
        individualBody.push([
            "",
            "",
            "",
            `${rows[0]?.investor_name ?? ""} total`,
            pkr(rows.reduce((sum, row) => sum + Number(row.amount), 0)),
        ]);
    }

    autoTable(doc, {
        ...tableStyle,
        startY: y,
        columnStyles: {
            0: { cellWidth: 12 },
            1: { cellWidth: 26 },
            2: { cellWidth: 38 },
            4: { halign: "right", cellWidth: 32 },
        },
        head: [["Sr #", "Date", "Investor", "Description", "Amount"]],
        body:
            individualBody.length > 0
                ? individualBody
                : [["", "", "", "No individual expense recorded.", ""]],
        foot:
            individualBody.length > 0
                ? [["", "", "", "Total individual", pkr(report.totals.individual)]]
                : undefined,
        didParseCell: (data) => {
            if (data.section === "foot" && data.column.index === 4) {
                data.cell.styles.halign = "right";
            }

            if (data.section === "body" && subtotalRows.has(data.row.index)) {
                data.cell.styles.fontStyle = "bold";
                data.cell.styles.fillColor = SHADE;
            }
        },
    });

    y = (doc.lastAutoTable?.finalY ?? y) + 10;

    // ---------------------------------------------------------- summary --
    heading("Summary");

    const last = report.periods.length + 3;

    autoTable(doc, {
        ...tableStyle,
        startY: y,
        columnStyles: { 0: { cellWidth: 12 } },
        head: [
            [
                "Sr #",
                "Investor",
                ...report.periods.map((period) => period.label),
                "Individual",
                "Total",
            ],
        ],
        body: report.rows.map((row, index) => [
            String(index + 1),
            row.investor_name,
            ...report.periods.map((period) => {
                const cell = row.by_period.find(
                    (entry) => entry.period_id === period.id
                );

                if (!cell) return "—";

                return cell.waived ? "waived" : pkr(cell.share);
            }),
            pkr(row.individual),
            pkr(row.total),
        ]),
        foot: [
            [
                "",
                "Total",
                ...report.periods.map((period) =>
                    pkr(
                        report.rows.reduce(
                            (sum, row) =>
                                sum +
                                Number(
                                    row.by_period.find(
                                        (entry) =>
                                            entry.period_id === period.id
                                    )?.share ?? 0
                                ),
                            0
                        )
                    )
                ),
                pkr(report.totals.individual),
                pkr(report.totals.billed),
            ],
        ],
        didParseCell: (data) => {
            if (data.column.index > 1) data.cell.styles.halign = "right";

            if (data.section === "body" && data.column.index === last) {
                data.cell.styles.fontStyle = "bold";
            }
        },
    });

    if (Number(report.totals.absorbed) > 0) {
        doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
        doc.text(
            `${pkr(report.totals.absorbed)} of the common expenses is waived and carried by the business, so the summary total is that much less than the total spent (${pkr(report.totals.spent)}).`,
            MARGIN,
            (doc.lastAutoTable?.finalY ?? y) + 5,
            { maxWidth: right - MARGIN }
        );
    }

    // ----------------------------------------------------------- footer --
    const pages = doc.getNumberOfPages();

    for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
        doc.text(`${businessName} · Expense report`, MARGIN, height - 8);
        doc.text(`Page ${page} of ${pages}`, right, height - 8, {
            align: "right",
        });
    }

    return doc;
}

export function downloadExpenseReportPdf(
    report: ExpenseReport,
    expenses: Expense[],
    periods: ExpensePeriod[],
    businessName?: string
): void {
    buildExpenseReportPdf(report, expenses, periods, businessName).save(
        expenseReportFileName(report)
    );
}
