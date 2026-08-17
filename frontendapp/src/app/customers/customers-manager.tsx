"use client";

import { useCallback, useState, useTransition } from "react";
import { deleteCustomer } from "./actions";
import { CustomerForm } from "./customer-form";
import type { Customer } from "@/types/customer";

type Props = {
    customers: Customer[];
    loadError: string | null;
};

export default function CustomersManager({ customers, loadError }: Props) {
    const [editing, setEditing] = useState<Customer | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    const handleSaved = useCallback((message: string) => {
        setEditing(null);
        setDeleteError(null);
        setNotice(message);
    }, []);

    const handleCancel = useCallback(() => {
        setEditing(null);
    }, []);

    function handleEdit(customer: Customer) {
        setNotice(null);
        setDeleteError(null);
        setEditing(customer);
    }

    function handleDelete(customer: Customer) {
        if (!window.confirm(`Delete ${customer.name}? This cannot be undone.`)) {
            return;
        }

        setNotice(null);
        setDeleteError(null);
        setDeletingId(customer.id);

        startTransition(async () => {
            const result = await deleteCustomer(customer.id);

            setDeletingId(null);

            if (result.ok) {
                setNotice(result.message);
                // The deleted row may be the one open in the form.
                setEditing((current) =>
                    current?.id === customer.id ? null : current
                );
            } else {
                setDeleteError(result.message);
            }
        });
    }

    return (
        <div className="mx-auto w-full max-w-5xl px-6 py-12">
            <header className="mb-8">
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                    Customers
                </h1>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {customers.length} record{customers.length === 1 ? "" : "s"}
                </p>
            </header>

            {loadError ? (
                <p className="mb-6 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {loadError}
                </p>
            ) : null}

            {notice ? (
                <p className="mb-6 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                    {notice}
                </p>
            ) : null}

            {deleteError ? (
                <p className="mb-6 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                    {deleteError}
                </p>
            ) : null}

            <CustomerForm
                key={editing?.id ?? "new"}
                customer={editing}
                onSaved={handleSaved}
                onCancel={handleCancel}
            />

            <div className="mt-8 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                        <tr>
                            <th className="px-4 py-3 font-medium">Name</th>
                            <th className="px-4 py-3 font-medium">CNIC</th>
                            <th className="px-4 py-3 font-medium">Phone</th>
                            <th className="px-4 py-3 font-medium">Address</th>
                            <th className="px-4 py-3 font-medium">Added</th>
                            <th className="px-4 py-3 text-right font-medium">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {customers.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={6}
                                    className="px-4 py-10 text-center text-zinc-500 dark:text-zinc-400"
                                >
                                    No customers yet.
                                </td>
                            </tr>
                        ) : (
                            customers.map((customer) => (
                                <tr
                                    key={customer.id}
                                    className="align-top text-zinc-800 dark:text-zinc-200"
                                >
                                    <td className="px-4 py-3 font-medium">
                                        {customer.name}
                                    </td>
                                    <td className="px-4 py-3 font-mono text-xs">
                                        {customer.cnic}
                                    </td>
                                    <td className="px-4 py-3">
                                        {customer.phoneNumber}
                                    </td>
                                    <td className="max-w-xs px-4 py-3 text-zinc-600 dark:text-zinc-400">
                                        {customer.address}
                                    </td>
                                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                                        {/* Sliced rather than locale-formatted so
                                            server and client markup match. */}
                                        {customer.createdAt.slice(0, 10)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleEdit(customer)
                                                }
                                                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleDelete(customer)
                                                }
                                                disabled={
                                                    deletingId === customer.id
                                                }
                                                className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                                            >
                                                {deletingId === customer.id
                                                    ? "Deleting…"
                                                    : "Delete"}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
