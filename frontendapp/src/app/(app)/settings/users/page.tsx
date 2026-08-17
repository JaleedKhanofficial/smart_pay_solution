import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { findNavItem } from "@/lib/navigation";

export const metadata: Metadata = { title: "Users · SmartPay Solutions" };

export default function UsersPage() {
    const item = findNavItem("/settings/users");

    if (!item) notFound();

    return <ModulePlaceholder item={item} />;
}
