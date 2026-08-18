"use client";

import { useEffect, useState, type InputHTMLAttributes } from "react";
import { Icon } from "./icons";

export const fieldClass =
    "w-full rounded-md border border-border bg-surface px-3 py-2.5 text-base text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-navy-600 disabled:opacity-60 sm:py-2 sm:text-sm";

export const labelClass =
    "mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted";

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
};

export function TextField({ label, name, ...props }: TextFieldProps) {
    return (
        <div>
            <label className={labelClass} htmlFor={name}>
                {label}
            </label>
            <input id={name} name={name} className={fieldClass} {...props} />
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
    existingFileId?: string | null;
};

/** FR-CUS-04-v2 picker with a preview; leaving it empty keeps the stored image. */
export function ImageField({ label, name, existingFileId }: ImageFieldProps) {
    const [preview, setPreview] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            if (preview) URL.revokeObjectURL(preview);
        };
    }, [preview]);

    const shown =
        preview ??
        (existingFileId
            ? `/media/${encodeURIComponent(existingFileId)}`
            : null);

    return (
        <div>
            <span className={labelClass}>{label}</span>
            <div className="flex items-center gap-3">
                <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface-muted">
                    {shown ? (
                        // Plain <img>: the optimiser would fetch /media without
                        // the session cookie and get a 401.
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

                <div className="min-w-0 flex-1">
                    <input
                        id={name}
                        name={name}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => {
                            const file = event.target.files?.[0];

                            if (preview) URL.revokeObjectURL(preview);

                            setPreview(file ? URL.createObjectURL(file) : null);
                            setFileName(file?.name ?? null);
                        }}
                        className="block w-full text-xs text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-surface-muted"
                    />
                    <p className="mt-1 truncate text-[11px] text-muted">
                        {fileName
                            ? fileName
                            : existingFileId
                              ? "Stored image kept unless you choose a new one"
                              : "JPG, PNG or WebP · 5 MB max"}
                    </p>
                </div>
            </div>
        </div>
    );
}
