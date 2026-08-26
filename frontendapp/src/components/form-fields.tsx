"use client";

import {
    useEffect,
    useRef,
    useState,
    type InputHTMLAttributes,
    type SelectHTMLAttributes,
} from "react";
import { Icon } from "./icons";

export const fieldClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-chrome-600 disabled:opacity-60 sm:py-2 sm:text-sm";

export const labelClass =
    "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted";

/** FR-CUS-02: `#####-#######-#` as the user types. */
export function formatCnic(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 13);

    if (digits.length <= 5) return digits;
    if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;

    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

/** FR-CUS-02: `0300-1234567` as the user types. */
export function formatMobile(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 11);

    return digits.length <= 4 ? digits : `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
    label: string;
    name: string;
    /** A line under the field, for a rule the label cannot carry on its own. */
    hint?: string;
};

export function TextField({ label, name, hint, ...props }: TextFieldProps) {
    return (
        <div>
            <label className={labelClass} htmlFor={name}>
                {label}
            </label>
            <input id={name} name={name} className={fieldClass} {...props} />
            {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </div>
    );
}

type SelectOption = { value: string; label: string };

/**
 * A native select styled as a field. Native rather than a custom listbox on
 * purpose: it is keyboard-accessible for free and, on a phone, opens the OS
 * picker rather than a cramped in-page menu.
 */
export function SelectField({
    label,
    name,
    options,
    defaultValue,
    hint,
    ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
    label: string;
    name: string;
    options: SelectOption[];
    hint?: string;
}) {
    return (
        <div>
            <label className={labelClass} htmlFor={name}>
                {label}
            </label>
            <select
                id={name}
                name={name}
                defaultValue={defaultValue}
                className={fieldClass}
                {...props}
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </div>
    );
}

export function TextAreaField({
    label,
    name,
    defaultValue,
    ...props
}: {
    label: string;
    name: string;
    defaultValue?: string;
    required?: boolean;
    rows?: number;
    maxLength?: number;
    placeholder?: string;
}) {
    return (
        <div>
            <label className={labelClass} htmlFor={name}>
                {label}
            </label>
            <textarea
                id={name}
                name={name}
                defaultValue={defaultValue}
                className={fieldClass}
                {...props}
            />
        </div>
    );
}

type MaskedFieldProps = {
    label: string;
    name: string;
    mask: "cnic" | "mobile";
    defaultValue?: string;
    required?: boolean;
};

/** Auto-formatting input; the server normalises and validates again anyway. */
export function MaskedField({
    label,
    name,
    mask,
    defaultValue = "",
    required,
}: MaskedFieldProps) {
    const format = mask === "cnic" ? formatCnic : formatMobile;
    const [value, setValue] = useState(() => format(defaultValue));

    return (
        <div>
            <label className={labelClass} htmlFor={name}>
                {label}
            </label>
            <input
                id={name}
                name={name}
                value={value}
                onChange={(event) => setValue(format(event.target.value))}
                required={required}
                inputMode="numeric"
                autoComplete="off"
                placeholder={mask === "cnic" ? "12345-1234567-1" : "0300-1234567"}
                maxLength={mask === "cnic" ? 15 : 12}
                className={fieldClass}
            />
        </div>
    );
}

type ImageFieldProps = {
    label: string;
    name: string;
    /** Existing upload, streamed through /media so the token stays server-side. */
    existingFileId?: number | null;
};

/**
 * FR-CUS-04-v2 picker with a preview. Leaving it empty keeps the stored image;
 * the × clears it. Removing a stored image posts `remove_images=<name>`, which
 * is the only way the API is told to clear a column — an omitted file still
 * means "keep".
 */
export function ImageField({ label, name, existingFileId }: ImageFieldProps) {
    const [preview, setPreview] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [removed, setRemoved] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        return () => {
            if (preview) URL.revokeObjectURL(preview);
        };
    }, [preview]);

    const storedShown = existingFileId && !removed;

    const shown =
        preview ??
        (storedShown ? `/media/${encodeURIComponent(existingFileId)}` : null);

    function clear() {
        if (preview) URL.revokeObjectURL(preview);

        // Empties the file input, so a picked-then-cleared field is not sent.
        if (inputRef.current) inputRef.current.value = "";

        setPreview(null);
        setFileName(null);

        // Only a stored image needs telling the API; a picked one was never sent.
        if (existingFileId) setRemoved(true);
    }

    return (
        <div>
            <span className={labelClass}>{label}</span>
            <div className="flex items-center gap-3">
                {/* Two boxes on purpose: the outer one positions the ×, the
                    inner one clips the image. One box cannot do both, because
                    overflow-hidden would cut the corner off the button. */}
                <div className="relative shrink-0">
                    <div className="grid size-16 place-items-center overflow-hidden rounded-md border border-border bg-surface-muted">
                        {shown ? (
                            // Plain <img>: the optimiser would fetch /media
                            // without the session cookie and get a 401.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={shown}
                                alt={label}
                                className="size-full object-cover"
                            />
                        ) : (
                            <Icon name="fileText" className="size-5 text-muted" />
                        )}
                    </div>

                    {shown ? (
                        <button
                            type="button"
                            onClick={clear}
                            aria-label={`Remove ${label}`}
                            title="Remove image"
                            className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border border-border bg-surface text-muted shadow-sm transition-colors hover:border-negative hover:bg-negative hover:text-white"
                        >
                            <Icon name="close" className="size-3" />
                        </button>
                    ) : null}
                </div>

                <div className="min-w-0 flex-1">
                    <input
                        ref={inputRef}
                        id={name}
                        name={name}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                            const file = event.target.files?.[0];

                            if (preview) URL.revokeObjectURL(preview);

                            setPreview(file ? URL.createObjectURL(file) : null);
                            setFileName(file?.name ?? null);

                            // Picking a replacement supersedes a removal.
                            if (file) setRemoved(false);
                        }}
                        className="block w-full text-xs text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-surface-muted"
                    />
                    <p className="mt-1 truncate text-[11px] text-muted">
                        {fileName
                            ? fileName
                            : removed
                              ? "Image will be removed when you save"
                              : existingFileId
                                ? "Stored image kept unless you choose a new one"
                                : "JPG, PNG or WebP · 10 MB max"}
                    </p>
                </div>
            </div>

            {/* Read by the server action and forwarded to the API. Repeated
                across fields, so several images can be cleared in one save. */}
            {removed ? (
                <input type="hidden" name="remove_images" value={name} />
            ) : null}
        </div>
    );
}
