import { redirect } from "next/navigation";

export default function Home() {
    // proxy.ts sends unauthenticated visitors to /login before this renders.
    redirect("/dashboard");
}
