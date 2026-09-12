"use client";

import { TextArea } from "@heroui/react";
import { useState } from "react";
import {
  SUPPORT_EMAIL_MAX,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_NAME_MAX,
  SUPPORT_PHONE_MAX,
  type CreateSupportTicketInput,
  type SupportTopic,
} from "@injishi/contracts";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@injishi/ui";

import { submitSupportTicket } from "@/data/support";

/**
 * The support contact form.
 *
 * The capture shipped a react-select control and a set of inputs with no
 * submit handler, so nothing could be sent; the first fix posted to
 * `/api/support`, which has no handler anywhere. It now goes through
 * `submitSupportTicket` to the API's support intake, and only an answer that
 * carries a ticket id counts as sent — a timeout, a refusal or a throttle all
 * land on the error line with the phone number, never on "thanks".
 */

/**
 * The topic travels as a slug from a closed set, not as this label: it becomes
 * the ticket's subject line on the staff screen, and a closed set cannot carry
 * a stranger's words there.
 */
const TOPICS: { value: SupportTopic; label: string }[] = [
  { value: "booking", label: "A booking I have made" },
  { value: "payment", label: "Payment or refund" },
  { value: "listing", label: "Listing my accommodation" },
  { value: "other", label: "Something else" },
];

/**
 * Each half of the name gets half of the contract's cap, less the joining
 * space, so a full name the browser lets through is one the API accepts.
 */
const NAME_PART_MAX = Math.floor((SUPPORT_NAME_MAX - 1) / 2);

/** A trimmed text field, or "" for a missing one (FormData can also hold files). */
function textOf(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * The request body. Blank optional fields are left out rather than sent as
 * "": the contract reads a present field as a claim to validate, and an empty
 * phone number is not one.
 */
function toInput(topic: SupportTopic, data: FormData): CreateSupportTicketInput {
  const name = [textOf(data, "firstName"), textOf(data, "lastName")]
    .filter(Boolean)
    .join(" ");
  const phone = textOf(data, "phone");
  return {
    topic,
    message: textOf(data, "message"),
    email: textOf(data, "email"),
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
  };
}

type Status = "idle" | "sending" | "sent" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [topic, setTopic] = useState<SupportTopic>("booking");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus("sending");

    const result = await submitSupportTicket(toInput(topic, new FormData(form)));
    if (result.status === "ok") {
      setStatus("sent");
      form.reset();
    } else {
      setStatus("error");
    }
  };

  return (
    <form onSubmit={submit} className="flex max-w-wide flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="topic">What is this about?</Label>
        <Select
          value={topic}
          onValueChange={(value) => {
            // Radix hands back a plain string; only a known slug is kept.
            const match = TOPICS.find((entry) => entry.value === value);
            if (match) setTopic(match.value);
          }}
        >
          <SelectTrigger id="topic">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TOPICS.map((entry) => (
              <SelectItem key={entry.value} value={entry.value}>
                {entry.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field
          id="firstName"
          label="First Name"
          autoComplete="given-name"
          maxLength={NAME_PART_MAX}
        />
        <Field
          id="lastName"
          label="Last Name"
          autoComplete="family-name"
          maxLength={NAME_PART_MAX}
        />
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          maxLength={SUPPORT_EMAIL_MAX}
        />
        <Field
          id="phone"
          label="Phone"
          type="tel"
          autoComplete="tel"
          required={false}
          maxLength={SUPPORT_PHONE_MAX}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">Message</Label>
        {/* The rounded, transparent box is this form's own look, so the field
            background is overridden on the ELEMENT rather than fought with a
            `bg-*` class — `.input` sets it from an unlayered rule and a utility
            would lose. */}
        <TextArea
          id="message"
          name="message"
          required
          maxLength={SUPPORT_MESSAGE_MAX}
          rows={5}
          className="w-full rounded-card border border-input px-5 py-3 text-base [--field-background:transparent]"
        />
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={status === "sending"}>
          {status === "sending" ? "Sending…" : "Send message"}
        </Button>

        <p aria-live="polite" className="text-sm">
          {status === "sent" ? (
            <span className="text-accent-text">Thanks. We will reply within a day.</span>
          ) : null}
          {status === "error" ? (
            <span className="text-destructive">
              That did not send. Call us on +250 784 530 000 and we will pick it up.
            </span>
          ) : null}
        </p>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  type = "text",
  autoComplete,
  required = true,
  maxLength,
}: {
  id: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  maxLength: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required={required}
        maxLength={maxLength}
      />
    </div>
  );
}
