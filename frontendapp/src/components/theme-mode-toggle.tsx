"use client";

import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";
import {
    THEME_MODE_COOKIE,
    themeAttribute,
    type ThemeMode,
} from "@/lib/theme-mode";

const OPTIONS: { mode: ThemeMode; label: string; icon: IconName }[] = [
    { mode: "light", label: "Light", icon: "sun" },
    { mode: "dark", label: "Dark", icon: "moon" },
    { mode: "system", label: "System", icon: "settings" },
];

/**
 * Segmented radio group for the light/dark choice. Switching swaps the token
 * block on <html>, so the whole interface re-colours without a re-render; the
 * cookie lets the server stamp the same choice on the next request, which is
 * what stops the page flashing the wrong appearance on load.
 */
export function ThemeModeToggle({ current }: { current: ThemeMode }) {
    const [mode, setMode] = useState<ThemeMode>(current);

    // The document is outside React's ownership, so the write belongs here
    // rather than in the change handler.
    useEffect(() => {
        const attribute = themeAttribute(mode);

        if (attribute) {
            document.documentElement.dataset.theme = attribute;
        } else {
            delete document.documentElement.dataset.theme;
        }

        document.cookie = `${THEME_MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
    }, [mode]);

    return (
        <div
            role="radiogroup"
            aria-label="Appearance"
            className="flex items-center gap-0.5 rounded-md border border-white/15 p-0.5"
        >
            {OPTIONS.map((option) => {
                const active = option.mode === mode;

                return (
                    <label
                        key={option.mode}
                        title={option.label}
                        className={`grid size-7 cursor-pointer place-items-center rounded transition-colors ${
                            active
                                ? "bg-white/15 text-white"
                                : "text-white/50 hover:text-white/80"
                        }`}
                    >
                        <input
                            type="radio"
                            name="sps-theme-mode"
                            value={option.mode}
                            checked={active}
                            onChange={() => setMode(option.mode)}
                            className="sr-only"
                        />
                        <Icon name={option.icon} className="size-4" />
                        <span className="sr-only">{option.label}</span>
                    </label>
                );
            })}
        </div>
    );
}
