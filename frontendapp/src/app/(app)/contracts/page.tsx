import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { findNavItem } from "@/lib/navigation";

export const metadata: Metadata = { title: "Contracts · SmartPay Solutions" };

export default function ContractsPage() {
    const item = findNavItem("/contracts");

    if (!item) notFound();

    return <ModulePlaceholder item={item} />;
}
