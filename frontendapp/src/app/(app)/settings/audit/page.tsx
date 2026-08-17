import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { findNavItem } from "@/lib/navigation";

export const metadata: Metadata = { title: "Audit Log · SmartPay Solutions" };

export default function AuditPage() {
    const item = findNavItem("/settings/audit");

    if (!item) notFound();

    return <ModulePlaceholder item={item} />;
}
