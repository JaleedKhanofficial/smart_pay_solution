/**
 * The business runs on Pakistan time and the API stores UTC, so the zone is
 * pinned here rather than left to the viewer's machine: a record created at
 * 01:00 local is 20:00 the previous day in UTC, and slicing the ISO string
 * would show the wrong date.
 *
 * Locale and time zone are both fixed, which also means the server and the
 * browser render identical text — no hydration mismatch.
 */
const TIME_ZONE = "Asia/Karachi";

const DATE = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
});

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
});

/** NFR-02: dates display dd-mm-yyyy. */
export function formatDate(iso: string): string {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) return iso;

    return DATE.format(date).replace(/\//g, "-");
}

/** Same date plus the time, for hover titles. */
export function formatDateTime(iso: string): string {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) return iso;

    return DATE_TIME.format(date).replace(/\//g, "-");
}
