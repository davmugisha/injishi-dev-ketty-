"use client";

import { Eye, EyeSlash } from "@gravity-ui/icons";
import { Button, Description, FieldError, InputGroup, Label, TextField } from "@heroui/react";
import { PASSWORD_MAX_LENGTH, PASSWORD_STRENGTH_LABEL, passwordStrength } from "@injishi/auth/client";
import { useState } from "react";

const STRENGTH_TONE = {
  "too-short": "text-muted",
  weak: "text-danger",
  fair: "text-warning",
  strong: "text-success",
} as const;

/**
 * A password input with a show/hide button. `isNew` adds the strength hint under it and the
 * `new-password` autocomplete, so a password manager offers to save it. The rule itself is the length.
 */
export function PasswordField({
  label,
  name,
  value,
  onChange,
  isNew = false,
  error,
  autoFocus,
  hideLabel = false,
}: {
  label: string;
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  isNew?: boolean;
  error?: string | null;
  autoFocus?: boolean;
  hideLabel?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const [inner, setInner] = useState("");
  const current = value ?? inner;
  const strength = passwordStrength(current);
  return (
    <TextField
      name={name}
      value={current}
      onChange={(v) => {
        if (value === undefined) setInner(v);
        onChange?.(v);
      }}
      isInvalid={!!error}
      fullWidth
      autoFocus={autoFocus}
      maxLength={PASSWORD_MAX_LENGTH}
    >
      <Label className={hideLabel ? "sr-only" : undefined}>{label}</Label>
      <InputGroup className="rounded-xl">
        <InputGroup.Input
          type={shown ? "text" : "password"}
          autoComplete={isNew ? "new-password" : "current-password"}
          placeholder={hideLabel ? label : undefined}
        />
        <InputGroup.Suffix className="pr-1">
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={shown ? "Hide password" : "Show password"}
            onPress={() => setShown((s) => !s)}
          >
            {shown ? <EyeSlash className="size-4" /> : <Eye className="size-4" />}
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
      {error ? (
        <FieldError>{error}</FieldError>
      ) : isNew ? (
        <Description className={current ? STRENGTH_TONE[strength] : "text-muted"}>
          {current ? PASSWORD_STRENGTH_LABEL[strength] : PASSWORD_STRENGTH_LABEL["too-short"]}
        </Description>
      ) : null}
    </TextField>
  );
}
