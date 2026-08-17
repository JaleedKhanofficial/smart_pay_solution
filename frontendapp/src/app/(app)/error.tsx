"use client";

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
            <button
                type="button"
                onClick={reset}
                className="mt-6 rounded-md bg-navy-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-navy-700"
            >
                Try again
            </button>
        </div>
    );
}
