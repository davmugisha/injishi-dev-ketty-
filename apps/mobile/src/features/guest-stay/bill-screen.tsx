import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Banner,
  Button,
  Card,
  Chip,
  Dialog,
  Field,
  Input,
  ListGroup,
  ListItem,
  LoadingBone,
  LoadingView,
  NavBar,
  Screen,
  TestMoneyTag,
  Text,
  useToast,
} from "@/components/ui";
import { QueryView } from "@/data/query-view";
import { rwf } from "@/lib/money";
import { href } from "@/proto/screens";
import { useBill, useSaveInvoice } from "./data";
import type { Bill, BillLine } from "./types";
import { backOr, CardBone, Eyebrow, figure, ListBones } from "./ui";

/** A Rwandan TIN: nine digits. */
const TIN = /^\d{9}$/;

/**
 * The bill, live: what is due now, what is posted, what is not posted yet, and the documents (the EBM
 * receipt, a company invoice) in one place. Paying opens the payment sheet over it.
 */
export function BillScreen() {
  const bill = useBill();
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const data = bill.data;
  return (
    <Screen
      header={
        <NavBar
          title="Your bill"
          subtitle={data ? `${data.place} · ${data.folio}` : undefined}
          onBack={() => backOr(href("guest-home-stay"))}
        />
      }
    >
      <QueryView offlineNote={null} query={bill} data={data} loading={<BillBones />}>
        {(b) => <BillBody bill={b} onInvoice={() => setInvoiceOpen(true)} />}
      </QueryView>
      {data ? <InvoiceDialog isOpen={invoiceOpen} onClose={() => setInvoiceOpen(false)} bill={data} /> : null}
    </Screen>
  );
}

function BillBody({ bill, onInvoice }: { bill: Bill; onInvoice: () => void }) {
  const settled = bill.due <= 0;
  return (
    <View className="gap-3 px-4 pt-1">
      <Card raised padding="lg">
        <View className="flex-row items-center justify-between gap-2">
          <Eyebrow>{settled ? "Nothing to pay now" : "To pay now"}</Eyebrow>
          <TestMoneyTag />
        </View>
        <Text role="display" tabular className="mt-1">
          {rwf(Math.max(0, bill.due))}
        </Text>
        <Text role="callout" tone="muted" className="mt-1">
          {`Posted ${rwf(bill.posted)} · ${bill.paidNote} ${rwf(bill.paidSoFar)}`}
        </Text>
        <View className="mt-4">
          {settled ? (
            <Chip tone="success" icon="CircleCheck" label="All paid · confirmed by the provider" size="lg" />
          ) : (
            <Button icon="Smartphone" onPress={() => router.push(href("guest-bill-pay"))}>
              Pay with MoMo
            </Button>
          )}
        </View>
      </Card>
      <Eyebrow className="mt-2">Posted so far</Eyebrow>
      {bill.lines.length > 0 ? (
        <ListGroup>
          {bill.lines.map((line) => (
            <LineRow key={line.id} line={line} />
          ))}
        </ListGroup>
      ) : (
        <Card tone="flat">
          <Text role="callout" tone="muted" className="text-center">
            Nothing is posted yet. Charges show here as the hotel posts them.
          </Text>
        </Card>
      )}
      {bill.pending ? <Banner icon="Moon" title={bill.pending.title} body={bill.pending.body} /> : null}
      <Eyebrow className="mt-2">Documents</Eyebrow>
      <ListGroup>
        <ListItem
          icon="QrCode"
          title="Fiscal receipt (EBM)"
          subtitle={bill.receipt}
          trailing={<Chip label="At checkout" />}
        />
        <ListItem
          icon="FileText"
          title="Invoice for your company"
          subtitle={
            bill.invoice
              ? `${bill.invoice.company} · TIN ${bill.invoice.tin} · issued at checkout`
              : "Add the company name and TIN before checkout"
          }
          onPress={onInvoice}
        />
        <ListItem
          icon="Comments"
          title="Question about a charge?"
          subtitle="Ask the desk in Messages"
          onPress={() => router.push(href("guest-chat"))}
        />
      </ListGroup>
    </View>
  );
}

/** One posted line: the figure at the end, a payment in success with a minus. */
function LineRow({ line }: { line: BillLine }) {
  const credit = line.amount < 0;
  return (
    <ListItem
      icon={line.icon}
      tone={line.tone}
      title={line.title}
      subtitle={line.detail}
      trailing={
        <Text
          role="callout"
          strong
          tabular
          tone={credit ? "success" : "default"}
          accessibilityLabel={credit ? `paid ${rwf(-line.amount)}` : rwf(line.amount)}
        >
          {figure(line.amount)}
        </Text>
      }
    />
  );
}

/** The company invoice: a name and a TIN, kept until checkout issues it. */
function InvoiceDialog({ isOpen, onClose, bill }: { isOpen: boolean; onClose: () => void; bill: Bill }) {
  const save = useSaveInvoice();
  const toast = useToast();
  const [company, setCompany] = useState(bill.invoice?.company ?? "");
  const [tin, setTin] = useState(bill.invoice?.tin ?? "");
  const [tried, setTried] = useState(false);
  const tinError = tried && !TIN.test(tin.trim()) ? "A TIN is 9 digits, as on the company's RRA certificate." : undefined;
  const nameError = tried && company.trim().length < 2 ? "Add the company's registered name." : undefined;
  const submit = () => {
    setTried(true);
    if (company.trim().length < 2 || !TIN.test(tin.trim())) return;
    save.mutate(
      { company: company.trim(), tin: tin.trim() },
      {
        onSuccess: () => {
          onClose();
          toast.show({ icon: "FileText", message: "Saved. The invoice is issued at checkout." });
        },
      },
    );
  };
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      icon="FileText"
      title="Invoice for your company"
      body="The desk issues it with the fiscal receipt at checkout."
      actions={
        <>
          <Button onPress={submit} isDisabled={save.isPending}>
            Save for checkout
          </Button>
          <Button variant="ghost" onPress={onClose}>
            Not now
          </Button>
        </>
      }
    >
      <View className="gap-3">
        <Field label="Company name" error={nameError}>
          <Input value={company} onChangeText={setCompany} placeholder="Kivu Ventures Ltd" autoCapitalize="words" />
        </Field>
        <Field label="TIN" error={tinError}>
          <Input value={tin} onChangeText={setTin} placeholder="9 digits" keyboardType="number-pad" maxLength={9} />
        </Field>
      </View>
    </Dialog>
  );
}

function BillBones() {
  return (
    <LoadingView label="Loading your bill" className="px-4 pt-1">
      <CardBone className="h-48" />
      <LoadingBone className="h-3 w-1/4" />
      <ListBones rows={4} />
      <CardBone className="h-16" />
    </LoadingView>
  );
}
