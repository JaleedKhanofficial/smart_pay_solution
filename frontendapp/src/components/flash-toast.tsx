"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useToast, type ToastTone } from "./toast";

type Props = {
    message?: string;
    tone?: ToastTone;
    /** Same page without the flash params, so a reload does not re-toast. */
    cleanUrl: string;
};

/** Shows the toast a redirecting Server Action left in the query string. */
export function FlashToast({ message, tone = "success", cleanUrl }: Props) {
    const { push } = useToast();
    const router = useRouter();
    const shown = useRef(false);

    useEffect(() => {
        if (!message || shown.current) return;

        shown.current = true;
        push(message, tone);
        router.replace(cleanUrl, { scroll: false });
    }, [message, tone, cleanUrl, push, router]);

    return null;
}
