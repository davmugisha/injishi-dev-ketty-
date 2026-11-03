"use client";

import { Button, Dropdown, Label } from "@heroui/react";
import { useState } from "react";
import { EXPORT_FORMATS, exportTable, type ExportFormat, type ExportTable } from "@/lib/table-export";

/**
 * Export, as CSV, Excel, PDF or Word (2026-11-02). `load` gathers the rows when a format is picked,
 * so the whole list is read only on demand; it answers the table, or a sentence saying why not.
 */
export function ExportMenu({
  load,
  isDisabled = false,
  onProblem,
}: {
  load: () => Promise<ExportTable | string>;
  isDisabled?: boolean;
  onProblem?: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const run = async (format: ExportFormat) => {
    setBusy(true);
    onProblem?.(null);
    const table = await load();
    setBusy(false);
    if (typeof table === "string") return onProblem?.(table);
    exportTable(format, table);
  };
  return (
    <Dropdown>
      <Button size="sm" variant="secondary" isPending={busy} isDisabled={isDisabled}>
        Export
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-[160px]">
        <Dropdown.Menu aria-label="Export as" onAction={(key) => void run(key as ExportFormat)}>
          {EXPORT_FORMATS.map((f) => (
            <Dropdown.Item key={f.id} id={f.id} textValue={f.label}>
              <Label>{f.label}</Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
