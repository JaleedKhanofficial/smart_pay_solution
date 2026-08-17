import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { findNavItem } from "@/lib/navigation";

export const metadata: Metadata = {
    title: "Summary Report · SmartPay Solutions",
};

export default function SummaryReportPage() {
    const item = findNavItem("/reports/summary");

    if (!item) notFound();

    return <ModulePlaceholder item={item} />;
}
