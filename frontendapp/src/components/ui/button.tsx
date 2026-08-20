import Link from "next/link";
import type {
    ButtonHTMLAttributes,
    ComponentProps,
    ReactNode,
    Ref,
} from "react";

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

/** Square padding for a button whose only child is an icon. */
const ICON_SIZES: Record<ButtonSize, string> = {
    sm: "p-1.5 text-xs",
    md: "p-2.5 text-sm sm:p-2",
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
    /**
     * The button shows an icon and nothing else. Padding goes square, and the
     * caller MUST supply `aria-label` — the icon itself is aria-hidden, so
     * without one the control has no accessible name at all.
     */
    iconOnly?: boolean;
    className?: string;
};

export function buttonClasses({
    variant = "primary",
    size = "md",
    fullWidth = false,
    stackOnMobile = false,
    iconOnly = false,
    className = "",
}: ButtonStyleProps = {}): string {
    const width = fullWidth
        ? "w-full"
        : stackOnMobile
          ? "w-full sm:w-auto"
          : "";

    const padding = iconOnly ? ICON_SIZES[size] : SIZES[size];

    return [BASE, padding, VARIANTS[variant], width, className]
        .filter(Boolean)
        .join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
    ButtonStyleProps & {
        children: ReactNode;
        /** React 19 hands `ref` through as a normal prop — no forwardRef. */
        ref?: Ref<HTMLButtonElement>;
    };

export function Button({
    variant,
    size,
    fullWidth,
    stackOnMobile,
    iconOnly,
    className,
    type = "button",
    ref,
    children,
    ...props
}: ButtonProps) {
    return (
        <button
            ref={ref}
            type={type}
            className={buttonClasses({
                variant,
                size,
                fullWidth,
                stackOnMobile,
                iconOnly,
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
    iconOnly,
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
                iconOnly,
                className,
            })}
            {...props}
        >
            {children}
        </Link>
    );
}
