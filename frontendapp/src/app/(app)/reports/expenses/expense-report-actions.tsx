"use client";

import { DownloadPdfButton } from "@/components/download-pdf-button";
import { downloadExpenseReportPdf } from "@/lib/expense-report-pdf";
import type { Expense, ExpensePeriod, ExpenseReport } from "@/types/expense";

/**
 * BR-31. The report as a downloadable PDF.
 *
 * Built from the data already on the page, so the document says what the
 * screen says and no second round trip can return something different.
 */
export function ExpenseReportActions({
    report,
    expenses,
    periods,
    businessName,
}: {
    report: ExpenseReport;
    expenses: Expense[];
    periods: ExpensePeriod[];
    businessName: string;
}) {
    return (
        <DownloadPdfButton
            disabled={expenses.length === 0}
            build={() =>
                downloadExpenseReportPdf(report, expenses, periods, businessName)
            }
        />
    );
}
