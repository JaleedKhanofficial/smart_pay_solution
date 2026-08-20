"use client";

import { Button } from "@/components/ui/button";

export default function AppError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="mx-auto w-full max-w-2xl px-6 py-16">
            <h1 className="text-xl font-semibold text-foreground">
                Something went wrong
            </h1>
            <p className="mt-2 text-sm text-muted">
                {error.message ||
                    "The API did not respond. Check that the NestJS server is running on port 5000."}
            </p>
            <Button onClick={reset} className="mt-6">
                Try again
            </Button>
        </div>
    );
}
