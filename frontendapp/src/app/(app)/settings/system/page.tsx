import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { findNavItem } from "@/lib/navigation";

export const metadata: Metadata = {
    title: "System Settings · SmartPay Solutions",
};

export default function SystemSettingsPage() {
    const item = findNavItem("/settings/system");

    if (!item) notFound();

    return <ModulePlaceholder item={item} />;
}
