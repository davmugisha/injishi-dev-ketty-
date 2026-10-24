"use client";

import { toast } from "@heroui/react";
import { ListView } from "@heroui-pro/react";
import type { BlockView, RentalPropertyView } from "@injishi/contracts";
import { ActionButton, EmptyBlock, FormDialog, formatNumber, IconAction, SelectField, SidePanel } from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createBlock, updateBlock } from "../actions";
import { fieldErrorsOnly, TextInput } from "../fields";

function BlockDialog({
  block,
  properties,
  onClose,
}: {
  block: BlockView | null;
  properties: RentalPropertyView[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState(block?.code ?? "");
  const [name, setName] = useState(block?.name ?? "");
  const [propertyId, setPropertyId] = useState<string | null>(block?.propertyId ?? properties[0]?.id ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const input = { code, name: name.trim() || code.trim() };
      const result = block
        ? await updateBlock(block.id, input)
        : await createBlock({ ...input, ...(properties.length > 1 && propertyId ? { propertyId } : {}) });
      if (!result.ok) {
        setErrors(fieldErrorsOnly(result.fieldErrors));
        setFormError(result.fieldErrors ? null : result.error);
        return;
      }
      toast.success(block ? `Block ${result.value.code} saved` : `Block ${result.value.code} added`);
      onClose();
      router.refresh();
    });

  return (
    <FormDialog
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={block ? `Edit block ${block.code}` : "Add a block"}
      description={block ? undefined : "A building, a wing or a floor your units are in."}
      submitLabel={block ? "Save" : "Add block"}
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      size="sm"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {!block && properties.length > 1 ? (
        <SelectField
          label="Building"
          name="propertyId"
          options={properties.map((p) => ({ id: p.id, label: p.name }))}
          value={propertyId}
          onChange={setPropertyId}
          isRequired
        />
      ) : null}
      <TextInput
        label="Code"
        name="code"
        value={code}
        onChange={setCode}
        placeholder="A"
        description="What unit names in it start with."
        isRequired
        autoFocus
      />
      <TextInput label="Name" name="name" value={name} onChange={setName} placeholder="Block A" />
    </FormDialog>
  );
}

/** The blocks units stand in: listed with their unit counts, added and renamed. */
export function BlocksPanel({
  blocks,
  properties,
  canManage,
  onClose,
}: {
  blocks: BlockView[];
  properties: RentalPropertyView[];
  canManage: boolean;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<BlockView | "new" | null>(null);
  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Blocks"
      description="Group units by building, wing or floor."
      footer={
        canManage ? (
          <ActionButton icon="Plus" intent="primary" onPress={() => setEditing("new")}>
            Add block
          </ActionButton>
        ) : undefined
      }
    >
      {blocks.length === 0 ? (
        <EmptyBlock
          size="sm"
          icon="LayoutCells"
          title="No blocks yet"
          description="Units without a block are fine too."
        />
      ) : (
        <ListView aria-label="Blocks" variant="secondary" items={blocks}>
          {(b) => (
            <ListView.Item id={b.id} textValue={b.name} className="items-center">
              <ListView.ItemContent className="items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-default text-sm font-semibold">
                  {b.code}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <ListView.Title>{b.name}</ListView.Title>
                  <ListView.Description>
                    {formatNumber(b.unitCount)} {b.unitCount === 1 ? "unit" : "units"}
                  </ListView.Description>
                </span>
              </ListView.ItemContent>
              {canManage ? (
                <ListView.ItemAction>
                  <IconAction icon="PencilToSquare" label={`Edit block ${b.code}`} onPress={() => setEditing(b)} />
                </ListView.ItemAction>
              ) : null}
            </ListView.Item>
          )}
        </ListView>
      )}
      {editing ? (
        <BlockDialog
          block={editing === "new" ? null : editing}
          properties={properties}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </SidePanel>
  );
}
