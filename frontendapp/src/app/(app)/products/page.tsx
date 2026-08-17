import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModulePlaceholder } from "@/components/module-placeholder";
import { findNavItem } from "@/lib/navigation";

export const metadata: Metadata = { title: "Products · SmartPay Solutions" };

export default function ProductsPage() {
    const item = findNavItem("/products");

    if (!item) notFound();

    return <ModulePlaceholder item={item} />;
}
