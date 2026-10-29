"use client";

import { Gift } from "@gravity-ui/icons";
import {
  Alert,
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  NumberField,
  Radio,
  RadioGroup,
  TextArea,
  TextField,
} from "@heroui/react";
import { usePmsActions } from "@injishi/product-pms/web";
import { type FormEvent, useState, useTransition } from "react";

/** "New package": starts a draft package (name, what it includes, price, what the price covers). */
export function PackagesNewDialog({
  isOpen,
  onOpenChange,
  perOptions,
  onCreated,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  perOptions: string[];
  onCreated: (id: string) => void;
}) {
  const { createPackagesDraft } = usePmsActions();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const close = (open: boolean) => {
    if (!open) setError(null);
    onOpenChange(open);
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const price = Number(String(form.get("price") ?? "").replace(/[^\d.]/g, ""));
    const input = {
      name: String(form.get("name") ?? ""),
      summary: String(form.get("summary") ?? ""),
      price,
      per: String(form.get("per") ?? ""),
    };
    startTransition(async () => {
      const res = await createPackagesDraft(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onCreated(res.id);
      close(false);
    });
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={close}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-md">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
              <Gift className="size-5" />
            </Modal.Icon>
            <Modal.Heading>New package</Modal.Heading>
            <p className="mt-1.5 text-sm leading-5 text-muted">
              Starts as a draft. Add its components, each with a seller, tax classification and refund terms, before it
              goes on sale.
            </p>
          </Modal.Header>
          <Modal.Body>
            <Form id="packages-new-form" className="flex flex-col gap-4" onSubmit={submit}>
              {error ? (
                <Alert status="danger">
                  <Alert.Content>
                    <Alert.Title>{error}</Alert.Title>
                  </Alert.Content>
                </Alert>
              ) : null}
              <TextField isRequired name="name" variant="secondary" className="w-full">
                <Label>Package name</Label>
                <Input placeholder="Sunset Kayak Escape" />
                <FieldError />
              </TextField>
              <TextField isRequired name="summary" variant="secondary" className="w-full">
                <Label>What it includes</Label>
                <TextArea placeholder="1 night Deluxe Lake View, kayak hire and dinner" rows={2} />
                <FieldError />
              </TextField>
              <NumberField
                isRequired
                name="price"
                variant="secondary"
                minValue={1}
                step={1000}
                formatOptions={{ style: "currency", currency: "RWF", maximumFractionDigits: 0 }}
                className="w-full"
              >
                <Label>Package price</Label>
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input />
                  <NumberField.IncrementButton />
                </NumberField.Group>
                <Description>Taxes included, as configured per classification</Description>
                <FieldError />
              </NumberField>
              <RadioGroup isRequired name="per" defaultValue={perOptions[0]}>
                <Label>Price covers</Label>
                {perOptions.map((per) => (
                  <Radio key={per} value={per}>
                    <Radio.Content>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      {per}
                    </Radio.Content>
                  </Radio>
                ))}
              </RadioGroup>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancel
            </Button>
            <Button type="submit" form="packages-new-form" isPending={pending}>
              Create draft
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
