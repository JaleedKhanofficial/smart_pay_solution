/**
 * Plain module: a constant imported by a Server Component must not live in a
 * "use client" file, or it resolves to a client reference instead of its value.
 */
export const THEME_MODE_COOKIE = "sps_mode";

export const THEME_MODES = ["light", "dark", "system"] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

/** "system" follows the operating system, which is the browser default. */
export const DEFAULT_THEME_MODE: ThemeMode = "system";

export function isThemeMode(value: string | undefined): value is ThemeMode {
    return THEME_MODES.includes(value as ThemeMode);
}

/**
 * What to put on <html>. "system" sets nothing, leaving the media query in
 * charge; the other two override it.
 */
export function themeAttribute(mode: ThemeMode): string | undefined {
    return mode === "system" ? undefined : mode;
}
