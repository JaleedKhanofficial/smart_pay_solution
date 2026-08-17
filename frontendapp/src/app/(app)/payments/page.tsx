import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { findNavItem } from "@/lib/navigation";

export const metadata: Metadata = { title: "Payments · SmartPay Solutions" };

export default function PaymentsPage() {
    const item = findNavItem("/payments");

    if (!item) notFound();

    return <ModulePlaceholder item={item} />;
}
