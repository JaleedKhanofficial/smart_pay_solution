"use client";

import { useEffect, useId, useRef, useState } from "react";
import { fieldClass, labelClass } from "../form-fields";
import { Icon } from "../icons";

export type ComboboxOption = { value: string; label: string };

type Props = {
    label: string;
    name: string;
    options: ComboboxOption[];
    defaultValue?: string;
    required?: boolean;
    disabled?: boolean;
    hint?: string;
    placeholder?: string;
    /**
     * Fired with the chosen option's value. The hidden input still carries it
     * for the form post — this is for a caller that must *react* to the choice,
     * such as the payment form prefilling from the selected contract.
     */
    onValueChange?: (value: string) => void;
};

/**
 * A type-to-filter picker for lists too long to scan.
 *
 * `SelectField` stays the default everywhere else — a native `<select>` is
 * keyboard-accessible for free and opens the OS picker on a phone, which no
 * custom listbox beats. This exists for the two fields where the list grows
 * without limit: every customer, and every active product.
 *
 * **How the value is submitted.** The visible input holds the *search text*
 * and has no `name`, so it is never posted; a hidden input carries the chosen
 * option's value under `name`. Both are disabled together, so a disabled
 * combobox submits nothing at all — matching a disabled `<select>`, which is
 * what the locked-terms edit path relies on (FR-CON-07-v2).
 *
 * **Required.** `required` sits on the *visible* input rather than the hidden
 * one: a hidden field cannot be focused, so the browser refuses to report the
 * error and blocks submission with a console warning instead. It is a sound
 * proxy because the search text is reset to the selected option's label
 * whenever the list closes — so an empty box means nothing is selected.
 */
export function ComboboxField({
    label,
    name,
    options,
    defaultValue = "",
    required,
    disabled,
    hint,
    placeholder = "Type to search…",
    onValueChange,
}: Props) {
    const listId = useId();
    const optionId = (index: number) => `${listId}-option-${index}`;

    const [value, setValue] = useState(defaultValue);
    const labelFor = (candidate: string) =>
        options.find((option) => option.value === candidate)?.label ?? "";

    const [query, setQuery] = useState(() => labelFor(defaultValue));
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);

    const rootRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    // While closed the box shows the selection, so a search that matched
    // nothing does not linger and read as if it were chosen.
    const selectedLabel = labelFor(value);

    const matches = open
        ? options.filter((option) =>
              option.label.toLowerCase().includes(query.trim().toLowerCase())
          )
        : options;

    function choose(option: ComboboxOption) {
        setValue(option.value);
        setQuery(option.label);
        setOpen(false);
        onValueChange?.(option.value);
    }

    function close() {
        setOpen(false);
        setQuery(selectedLabel);
    }

    // Pointerdown rather than click: it fires before a click on the submit
    // button completes, so the revert above lands before the form is validated.
    useEffect(() => {
        if (!open) return;

        function onPointerDown(event: PointerEvent) {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
                setQuery(selectedLabel);
            }
        }

        document.addEventListener("pointerdown", onPointerDown);

        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, [open, selectedLabel]);

    // Keeps the highlighted row visible when arrowing past the fold. Indexed
    // rather than queried by id: the children are the matches, in order.
    useEffect(() => {
        if (!open) return;

        listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
    }, [active, open]);

    function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();

            if (!open) {
                setOpen(true);
                setActive(
                    Math.max(
                        0,
                        options.findIndex((option) => option.value === value)
                    )
                );

                return;
            }

            const step = event.key === "ArrowDown" ? 1 : -1;
            const count = matches.length;

            if (count > 0) {
                setActive((current) => (current + step + count) % count);
            }

            return;
        }

        if (event.key === "Enter") {
            // Only swallow the key when it is doing something here; otherwise
            // a closed combobox would block submitting the form from the field.
            if (open && matches[active]) {
                event.preventDefault();
                choose(matches[active]);
            }

            return;
        }

        if (event.key === "Escape" && open) {
            event.preventDefault();
            close();

            return;
        }

        if (event.key === "Tab" && open) {
            close();
        }
    }

    return (
        <div ref={rootRef} className="relative">
            <label className={labelClass} htmlFor={`${listId}-input`}>
                {label}
            </label>

            <div className="relative">
                <input
                    id={`${listId}-input`}
                    type="text"
                    role="combobox"
                    autoComplete="off"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={
                        open && matches[active] ? optionId(active) : undefined
                    }
                    required={required}
                    disabled={disabled}
                    value={query}
                    placeholder={placeholder}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setActive(0);
                        setOpen(true);
                    }}
                    onFocus={(event) => {
                        // Selecting the text means typing replaces the current
                        // choice instead of appending to it.
                        event.target.select();
                        setOpen(true);
                        // Land on the current choice, not always the first row.
                        setActive(
                            Math.max(
                                0,
                                options.findIndex(
                                    (option) => option.value === value
                                )
                            )
                        );
                    }}
                    onKeyDown={onKeyDown}
                    className={`${fieldClass} pr-9`}
                />

                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">
                    <Icon
                        name={open ? "search" : "chevronDown"}
                        className="size-4"
                    />
                </span>
            </div>

            {/* The field's actual value. Disabled alongside the input so a
                locked field posts nothing, exactly as a disabled select does. */}
            <input type="hidden" name={name} value={value} disabled={disabled} />

            {open ? (
                <ul
                    ref={listRef}
                    id={listId}
                    role="listbox"
                    aria-label={label}
                    className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg"
                >
                    {matches.length === 0 ? (
                        <li className="px-3 py-2 text-sm text-muted">
                            Nothing matches “{query.trim()}”
                        </li>
                    ) : (
                        matches.map((option, index) => {
                            const selected = option.value === value;

                            return (
                                <li
                                    key={option.value}
                                    id={optionId(index)}
                                    role="option"
                                    aria-selected={selected}
                                    onPointerDown={(event) => {
                                        // Keeps focus on the input, so the
                                        // outside-click handler does not fire
                                        // and close the list first.
                                        event.preventDefault();
                                        choose(option);
                                    }}
                                    onMouseMove={() => setActive(index)}
                                    className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${
                                        index === active
                                            ? "bg-surface-muted text-foreground"
                                            : "text-foreground"
                                    }`}
                                >
                                    <span className="truncate">
                                        {option.label}
                                    </span>
                                    {selected ? (
                                        <Icon
                                            name="check"
                                            className="size-4 shrink-0 text-brand-ink"
                                        />
                                    ) : null}
                                </li>
                            );
                        })
                    )}
                </ul>
            ) : null}

            {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </div>
    );
}
