"use client";

import { Label } from "@heroui/react";
import { NativeSelect } from "@heroui-pro/react";

export interface Choice {
  id: string;
  label: string;
}

/** A labelled native select (artifact: .native-select with a .label above it). */
export function ChoiceField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly Choice[];
  /** Shown while nothing is chosen (value ""), so no option is ever picked for the person. */
  placeholder?: string;
}) {
  return (
    <NativeSelect fullWidth variant="secondary" className="flex flex-col gap-[4px]">
      <Label htmlFor={id}>{label}</Label>
      <NativeSelect.Trigger id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder !== undefined ? (
          <NativeSelect.Option value="" disabled>
            {placeholder}
          </NativeSelect.Option>
        ) : null}
        {options.map((o) => (
          <NativeSelect.Option key={o.id} value={o.id}>
            {o.label}
          </NativeSelect.Option>
        ))}
        <NativeSelect.Indicator />
      </NativeSelect.Trigger>
    </NativeSelect>
  );
}

/** Required-field check that shows `message` without the required asterisk (the artboards print none). */
export const filled = (message: string) => (value: string) => (value.trim() ? null : message);

/** "184 KB" / "1.2 MB" for an attachment. */
export const fileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
