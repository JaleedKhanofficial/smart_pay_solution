import { NextResponse } from "next/server";
import { readTokens } from "@/lib/session";

const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";

/**
 * FR-SUM-07. The client profile modal opens on demand, so it needs a fetch the
 * browser can make — and the browser never holds the API token, which lives in
 * an httpOnly cookie on this origin (NFR-04). This forwards the call.
 *
 * A Server Action would have worked too, but this is a read with no side
 * effect and no form behind it; a GET route is the honest shape for it.
 * proxy.ts keeps the route behind the session.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
    const { id } = await params;

    if (!/^\d+$/.test(id)) {
        return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    const { access } = await readTokens();

    if (!access) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const upstream = await fetch(`${API_BASE}/reports/clients/${id}`, {
        headers: { Authorization: `Bearer ${access}` },
        cache: "no-store",
    });

    // The upstream body is already the shape the modal wants, error or not.
    return new NextResponse(await upstream.text(), {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
    });
}
