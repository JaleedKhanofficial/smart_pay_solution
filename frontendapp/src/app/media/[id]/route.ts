import { NextResponse } from "next/server";
import { readTokens } from "@/lib/session";

const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

/**
 * An <img> tag cannot send the API bearer token, and the API refuses
 * unauthenticated reads (FR-CUS-05-v2). This streams the file through the
 * Next server, which does hold the token — proxy.ts keeps the route itself
 * behind the session.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
    const { id } = await params;
    const { access } = await readTokens();

    if (!access) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // `id` is the numeric files.id; the API rejects anything else.
    const upstream = await fetch(`${API_BASE}/files/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${access}` },
        cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
        return new NextResponse("Not found", { status: upstream.status });
    }

    return new NextResponse(upstream.body, {
        status: 200,
        headers: {
            "Content-Type":
                upstream.headers.get("content-type") ?? "application/octet-stream",
            "Cache-Control": "private, max-age=300",
            "X-Content-Type-Options": "nosniff",
        },
    });
}
