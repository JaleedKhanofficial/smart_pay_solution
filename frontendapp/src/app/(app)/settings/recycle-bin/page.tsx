import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { findNavItem } from "@/lib/navigation";

export const metadata: Metadata = { title: "Recycle Bin · SmartPay Solutions" };

export default function RecycleBinPage() {
    const item = findNavItem("/settings/recycle-bin");

    if (!item) notFound();

    return <ModulePlaceholder item={item} />;
}
