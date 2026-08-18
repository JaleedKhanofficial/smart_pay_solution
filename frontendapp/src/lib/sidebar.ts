/**
 * Shared by the server layout and the client shell, so it lives in a plain
 * module: a constant exported from a "use client" file resolves to a client
 * reference on the server, not to its value.
 */
export const SIDEBAR_COOKIE = "sps_sidebar";

export type SidebarState = "collapsed" | "expanded";
