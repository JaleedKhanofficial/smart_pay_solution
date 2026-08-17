import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { findNavItem } from "@/lib/navigation";

export const metadata: Metadata = { title: "Recovery · SmartPay Solutions" };

export default function RecoveryPage() {
    const item = findNavItem("/recovery");

    if (!item) notFound();

    return <ModulePlaceholder item={item} />;
}
