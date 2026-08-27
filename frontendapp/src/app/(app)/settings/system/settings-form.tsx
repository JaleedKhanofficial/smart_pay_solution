"use client";

import { useActionState } from "react";
import { saveSettings } from "./actions";
import { TextField } from "@/components/form-fields";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardFields, CardHeader } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { EMPTY_FORM_STATE } from "@/types/customer";
import {
    GROUP_BLURBS,
    GROUP_TITLES,
    type BusinessIdentity,
    type LoyaltyThresholds,
    type PunctualityThresholds,
    type Setting,
    type SettingGroup,
} from "@/types/setting";

type Props = { settings: Setting[] };

const BAND_LABELS = [
    "Early — Excellent",
    "On Time",
    "Slight Delay",
    "Late",
    "Very Late",
];

/**
 * The API sends `value` as `unknown` because the keys genuinely differ in
 * shape. These readers narrow one key each, falling back to the default the
 * server also sent — so a value the browser cannot understand still renders
 * something sane rather than an empty control.
 */
function read<T>(settings: Setting[], key: string, fallback: T): T {
    const entry = settings.find((setting) => setting.key === key);

    return (entry?.value as T) ?? fallback;
}

function GroupCard({
    group,
    settings,
    children,
}: {
    group: SettingGroup;
    settings: Setting[];
    children: React.ReactNode;
}) {
    const inGroup = settings.filter((setting) => setting.group === group);
    const pending = inGroup.some((setting) => !setting.in_effect);
    const touched = inGroup
        .map((setting) => setting.updated_at)
        .filter((value): value is string => value !== null)
        .sort()
        .at(-1);

    return (
        <Card>
            <CardHeader
                title={GROUP_TITLES[group]}
                description={GROUP_BLURBS[group]}
                actions={
                    pending ? (
                        <Badge tone="neutral">not yet in effect</Badge>
                    ) : touched ? (
                        <span className="text-[11px] text-muted">
                            changed {formatDateTime(touched)}
                        </span>
                    ) : (
                        <span className="text-[11px] text-muted">default</span>
                    )
                }
            />
            {children}
        </Card>
    );
}

export function SettingsForm({ settings }: Props) {
    const [state, formAction, pending] = useActionState(
        saveSettings,
        EMPTY_FORM_STATE
    );

    const identity = read<BusinessIdentity>(settings, "business_identity", {
        name: "",
        tagline: "",
        address: "",
        phone: "",
        email: "",
    });
    const bands = read<PunctualityThresholds>(
        settings,
        "punctuality_thresholds",
        [4, 9, 14, 19, 24]
    );
    const loyalty = read<LoyaltyThresholds>(settings, "loyalty", {
        gold_min_within_pct: 80,
        silver_max_late_pct: 50,
        platinum_reduction_pct: 5,
        gold_reduction_pct: 3,
        silver_reduction_pct: 1,
    });

    const describe = (key: string) =>
        settings.find((setting) => setting.key === key)?.description ?? "";

    return (
        <form action={formAction} className="flex flex-col gap-6">
            <GroupCard group="business" settings={settings}>
                <CardFields wide>
                    <TextField
                        label="Business name"
                        name="business_name"
                        required
                        maxLength={120}
                        defaultValue={identity.name}
                        hint="Required — it heads every printed agreement."
                    />
                    <TextField
                        label="Tagline"
                        name="business_tagline"
                        maxLength={120}
                        defaultValue={identity.tagline}
                    />
                    <div className="sm:col-span-2">
                        <TextField
                            label="Address"
                            name="business_address"
                            maxLength={200}
                            defaultValue={identity.address}
                            placeholder="Shop 12, Main Bazaar, Lahore"
                            hint="Left blank, the line is omitted from the agreement rather than printed empty."
                        />
                    </div>
                    <TextField
                        label="Phone"
                        name="business_phone"
                        maxLength={40}
                        defaultValue={identity.phone}
                        placeholder="0300-1234567"
                    />
                    <TextField
                        label="Email"
                        name="business_email"
                        type="email"
                        maxLength={120}
                        defaultValue={identity.email}
                    />
                </CardFields>
            </GroupCard>

            <GroupCard group="contracts" settings={settings}>
                <CardFields>
                    <TextField
                        label="Shortest plan (months)"
                        name="plan_months_min"
                        type="number"
                        min={1}
                        max={120}
                        required
                        defaultValue={String(read(settings, "plan_months_min", 1))}
                    />
                    <TextField
                        label="Longest plan (months)"
                        name="plan_months_max"
                        type="number"
                        min={1}
                        max={120}
                        required
                        defaultValue={String(
                            read(settings, "plan_months_max", 20)
                        )}
                        hint="A contract outside this range is refused when it is written."
                    />
                </CardFields>
            </GroupCard>

            <GroupCard group="payments" settings={settings}>
                <div className="px-4 py-4 sm:px-5">
                    <label className="flex items-start gap-3">
                        <input
                            type="checkbox"
                            name="allow_overpayment"
                            defaultChecked={read(
                                settings,
                                "allow_overpayment",
                                false
                            )}
                            className="mt-0.5 size-4 accent-chrome-800"
                        />
                        <span>
                            <span className="text-sm font-medium text-foreground">
                                Allow overpayment
                            </span>
                            <span className="mt-0.5 block text-xs text-muted">
                                {describe("allow_overpayment")}
                            </span>
                        </span>
                    </label>
                </div>
            </GroupCard>

            <GroupCard group="recovery" settings={settings}>
                <div className="border-b border-border px-4 py-4 sm:px-5">
                    <p className="mb-3 text-xs text-muted">
                        {describe("punctuality_thresholds")}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {BAND_LABELS.map((label, index) => (
                            <TextField
                                key={label}
                                label={label}
                                name={`band_${index}`}
                                type="number"
                                min={0}
                                max={365}
                                required
                                defaultValue={String(bands[index])}
                                hint={
                                    index === 0
                                        ? "up to this day"
                                        : `after ${bands[index - 1]}`
                                }
                            />
                        ))}
                    </div>
                    <p className="mt-3 text-xs text-muted">
                        Anything later than {bands[4]} days is{" "}
                        <span className="font-medium text-foreground">
                            Overdue
                        </span>
                        . Each bound must be larger than the one before it.
                    </p>
                </div>

                <div className="px-4 py-4 sm:px-5">
                    <p className="mb-3 text-xs text-muted">
                        {describe("loyalty")}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <TextField
                            label="Gold needs (%) within"
                            name="gold_min_within_pct"
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            required
                            defaultValue={String(loyalty.gold_min_within_pct)}
                            hint="Share inside the first two bands."
                        />
                        <TextField
                            label="Silver allows under (%) late"
                            name="silver_max_late_pct"
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            required
                            defaultValue={String(loyalty.silver_max_late_pct)}
                            hint="At or above this share in the late bands means Caution."
                        />
                        <div className="hidden lg:block" />
                        <TextField
                            label="Platinum reduction (%)"
                            name="platinum_reduction_pct"
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            required
                            defaultValue={String(loyalty.platinum_reduction_pct)}
                        />
                        <TextField
                            label="Gold reduction (%)"
                            name="gold_reduction_pct"
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            required
                            defaultValue={String(loyalty.gold_reduction_pct)}
                        />
                        <TextField
                            label="Silver reduction (%)"
                            name="silver_reduction_pct"
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            required
                            defaultValue={String(loyalty.silver_reduction_pct)}
                        />
                    </div>
                </div>
            </GroupCard>

            <GroupCard group="retention" settings={settings}>
                <CardFields>
                    <TextField
                        label="Recycle Bin retention (days)"
                        name="recycle_bin_retention_days"
                        type="number"
                        min={1}
                        max={3650}
                        required
                        defaultValue={String(
                            read(settings, "recycle_bin_retention_days", 90)
                        )}
                        hint="Saved now, but nothing reads it until the Recycle Bin (Module 10) is built."
                    />
                </CardFields>
            </GroupCard>

            {state.message ? (
                <div
                    className={`rounded-md border px-4 py-3 text-sm ${
                        state.ok
                            ? "border-positive/40 bg-positive/8 text-positive"
                            : "border-negative/40 bg-negative/8 text-negative"
                    }`}
                >
                    {state.errors.length > 1 ? (
                        <>
                            <p className="mb-1 font-medium">
                                Nothing was saved. Please correct these:
                            </p>
                            <ul className="list-inside list-disc space-y-1">
                                {state.errors.map((error) => (
                                    <li key={error}>{error}</li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        state.message
                    )}
                </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
                <Button type="submit" disabled={pending} stackOnMobile>
                    <Icon name="check" className="size-4" />
                    {pending ? "Saving…" : "Save settings"}
                </Button>
                <p className="text-xs text-muted">
                    Changes take effect immediately and are recorded in the audit
                    log. Nothing is saved unless every field is valid.
                </p>
            </div>
        </form>
    );
}
