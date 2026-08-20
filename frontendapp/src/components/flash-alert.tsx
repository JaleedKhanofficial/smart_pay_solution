"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAlert, type DialogTone } from "./ui/alert-dialog";

type Props = {
    message?: string;
    tone?: DialogTone;
    /** Same page without the flash params, so a reload does not re-alert. */
    cleanUrl: string;
};

/**
 * Shows the dialog a redirecting Server Action left in the query string —
 * a create or update lands here after its redirect.
 */
export function FlashAlert({ message, tone = "success", cleanUrl }: Props) {
    const { alert } = useAlert();
    const router = useRouter();
    const shown = useRef(false);

    useEffect(() => {
        if (!message || shown.current) return;

        shown.current = true;

        // The URL is cleaned straight away rather than after the dialog
        // closes, so a reload while it is open does not show it twice.
        router.replace(cleanUrl, { scroll: false });

        void alert({ title: message, tone });
    }, [message, tone, cleanUrl, alert, router]);

    return null;
}
