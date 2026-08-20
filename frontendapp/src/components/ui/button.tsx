import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

/**
 * One definition for every button in the application. A `<button>` and a
 * `<Link>` styled the same way must not drift, so both are built from
 * `buttonClasses` rather than each carrying its own string.
 */
export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

const BASE =
    "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-60";

/** `md` keeps a 44px target on touch widths and tightens from sm: up (NFR-12.4). */
const SIZES: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2.5 text-sm sm:py-2",
};

const VARIANTS: Record<ButtonVariant, string> = {
    primary: "bg-chrome-800 text-white hover:bg-chrome-700",
    secondary: "border border-border text-foreground hover:bg-surface-muted",
    danger: "border border-negative/40 text-negative hover:bg-negative/8",
    ghost: "text-muted hover:bg-surface-muted hover:text-foreground",
};

export type ButtonStyleProps = {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Full width at every breakpoint — a lone action on a narrow card. */
    fullWidth?: boolean;
    /** Full width on phones, natural width from sm: up. The usual choice. */
    stackOnMobile?: boolean;
    className?: string;
};

export function buttonClasses({
    variant = "primary",
    size = "md",
    fullWidth = false,
    stackOnMobile = false,
    className = "",
}: ButtonStyleProps = {}): string {
    const width = fullWidth
        ? "w-full"
        : stackOnMobile
          ? "w-full sm:w-auto"
          : "";

    return [BASE, SIZES[size], VARIANTS[variant], width, className]
        .filter(Boolean)
        .join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
    ButtonStyleProps & { children: ReactNode };

export function Button({
    variant,
    size,
    fullWidth,
    stackOnMobile,
    className,
    type = "button",
    children,
    ...props
}: ButtonProps) {
    return (
        <button
            type={type}
            className={buttonClasses({
                variant,
                size,
                fullWidth,
                stackOnMobile,
                className,
            })}
            {...props}
        >
            {children}
        </button>
    );
}

type ButtonLinkProps = ComponentProps<typeof Link> &
    ButtonStyleProps & { children: ReactNode };

/** A link that looks like a button — navigation, not an action. */
export function ButtonLink({
    variant,
    size,
    fullWidth,
    stackOnMobile,
    className,
    children,
    ...props
}: ButtonLinkProps) {
    return (
        <Link
            className={buttonClasses({
                variant,
                size,
                fullWidth,
                stackOnMobile,
                className,
            })}
            {...props}
        >
            {children}
        </Link>
    );
}
