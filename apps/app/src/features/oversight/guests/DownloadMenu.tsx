"use client";

import { Button, Dropdown, Label } from "@heroui/react";
import { Icon, type IconKey } from "@injishi/ui";

export interface DownloadFile {
  id: string;
  label: string;
  /** What is in it, in a few words. */
  description: string;
  href: string;
  icon: IconKey;
}

/**
 * The downloads of a guest list or report, in one menu: Excel first (phones and ID numbers as text, real
 * dates, a frozen filterable header), then the PDF to print or send up the chain, then CSV for another
 * system. Each is exactly the view on screen: the address carries the same filters.
 */
export function DownloadMenu({
  files,
  intent = "secondary",
}: {
  files: DownloadFile[];
  intent?: "secondary" | "primary";
}) {
  return (
    <Dropdown>
      <Button variant={intent} size="sm" aria-label="Download this view">
        <Icon name="ArrowDownToLine" />
        Download
        <Icon name="ChevronDown" className="size-3.5" />
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-64">
        <Dropdown.Menu
          aria-label="Download as"
          onAction={(key) => {
            const file = files.find((f) => f.id === String(key));
            if (file) window.location.assign(file.href);
          }}
        >
          {files.map((f) => (
            <Dropdown.Item key={f.id} id={f.id} textValue={f.label}>
              <Icon name={f.icon} className="size-4 text-muted" />
              <span className="flex min-w-0 flex-col">
                <Label>{f.label}</Label>
                <span className="text-xs text-muted">{f.description}</span>
              </span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
