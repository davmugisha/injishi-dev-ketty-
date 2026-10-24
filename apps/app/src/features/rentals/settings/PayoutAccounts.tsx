"use client";

import { Avatar, Checkbox, Chip, Description, Label, toast } from "@heroui/react";
import { ListView, RadioButtonGroup, Segment } from "@heroui-pro/react";
import {
  MOMO_NETWORK_LABEL,
  type MomoNetwork,
  PAYOUT_ACCOUNT_KIND_LABEL,
  type PayoutAccountKind,
  type PayoutAccountView,
  RWANDA_BANKS,
} from "@injishi/contracts";
import {
  ActionButton,
  ConfirmDialog,
  EmptyBlock,
  Icon,
  IconAction,
  PhoneInput,
  RowActions,
  SectionCard,
  SelectField,
  SidePanel,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addPayoutAccount, makePrimaryPayoutAccount, retirePayoutAccount } from "../actions";
import { fieldErrorsOnly, TextInput } from "../fields";

const KIND_ICON: Record<PayoutAccountKind, string> = { bank: "Vault", momo: "Smartphone", momo_pay: "QrCode" };

function AddAccountPanel({
  isOpen,
  onOpenChange,
  firstAccount,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  firstAccount: boolean;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<PayoutAccountKind>("momo");
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState<string | null>(null);
  const [otherBankName, setOtherBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [network, setNetwork] = useState<MomoNetwork>("mtn");
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneText, setPhoneText] = useState("");
  const [merchantCode, setMerchantCode] = useState("");
  const [makePrimary, setMakePrimary] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const reset = () => {
    setAccountName("");
    setBankName(null);
    setOtherBankName("");
    setAccountNumber("");
    setPhone(null);
    setPhoneText("");
    setMerchantCode("");
    setErrors({});
    setFormError(null);
  };

  const submit = () => {
    const base = { accountName, makePrimary: firstAccount || makePrimary };
    const input =
      kind === "bank"
        ? { ...base, kind, bankName: bankName ?? undefined, otherBankName: otherBankName || undefined, accountNumber }
        : kind === "momo"
          ? { ...base, kind, momoNetwork: network, momoPhone: phone ?? phoneText }
          : { ...base, kind, merchantCode };
    start(async () => {
      const result = await addPayoutAccount(input);
      if (!result.ok) {
        setErrors(fieldErrorsOnly(result.fieldErrors));
        setFormError(result.fieldErrors ? null : result.error);
        return;
      }
      toast.success("Account added");
      reset();
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) reset();
        onOpenChange(open);
      }}
      title="Add a payout account"
      description="Rent paid through Injishi is sent here."
      submitLabel="Add account"
      isPending={pending}
      validationErrors={errors}
      formError={formError}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Paid into</span>
        <Segment
          aria-label="Kind of account"
          selectedKey={kind}
          onSelectionChange={(k) => {
            setKind(String(k) as PayoutAccountKind);
            setErrors({});
          }}
          className="w-full"
        >
          <Segment.Item id="momo">MoMo</Segment.Item>
          <Segment.Item id="bank">Bank</Segment.Item>
          <Segment.Item id="momo_pay">MoMo Pay</Segment.Item>
        </Segment>
      </div>

      <TextInput
        label="Name on the account"
        name="accountName"
        value={accountName}
        onChange={setAccountName}
        description="As the bank or the network has it."
        isRequired
      />

      {kind === "bank" ? (
        <>
          <SelectField
            label="Bank"
            name="bankName"
            options={RWANDA_BANKS}
            value={bankName}
            onChange={setBankName}
            errorMessage={errors.bankName}
            isRequired
          />
          {bankName === "Other" ? (
            <TextInput
              label="Bank's name"
              name="otherBankName"
              value={otherBankName}
              onChange={setOtherBankName}
              isRequired
            />
          ) : null}
          <TextInput
            label="Account number"
            name="accountNumber"
            value={accountNumber}
            onChange={setAccountNumber}
            inputMode="numeric"
            description="Only the last 4 digits are shown after you save."
            isRequired
          />
        </>
      ) : null}

      {kind === "momo" ? (
        <>
          <RadioButtonGroup
            aria-label="Network"
            layout="grid"
            value={network}
            onChange={(v) => setNetwork(v === "airtel" ? "airtel" : "mtn")}
            className="grid-cols-2 gap-2.5"
          >
            {(["mtn", "airtel"] as const).map((n) => (
              <RadioButtonGroup.Item key={n} value={n} className="gap-1 px-3.5 py-3">
                <RadioButtonGroup.Indicator>
                  <Icon name="CircleCheckFill" />
                </RadioButtonGroup.Indicator>
                <RadioButtonGroup.ItemContent>
                  <Label className="font-semibold">{MOMO_NETWORK_LABEL[n]}</Label>
                  <Description className="text-xs">{n === "mtn" ? "078 or 079" : "072 or 073"}</Description>
                </RadioButtonGroup.ItemContent>
              </RadioButtonGroup.Item>
            ))}
          </RadioButtonGroup>
          <PhoneInput
            label="MoMo number"
            name="momoPhone"
            value={phone}
            onChange={(e164, text) => {
              setPhone(e164);
              setPhoneText(text);
            }}
            errorMessage={errors.momoPhone}
            isRequired
          />
        </>
      ) : null}

      {kind === "momo_pay" ? (
        <TextInput
          label="MoMo Pay code"
          name="merchantCode"
          value={merchantCode}
          onChange={setMerchantCode}
          inputMode="numeric"
          description="The merchant code customers dial."
          isRequired
        />
      ) : null}

      {firstAccount ? null : (
        <Checkbox isSelected={makePrimary} onChange={setMakePrimary} variant="secondary">
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Label>Make it the primary account</Label>
          </Checkbox.Content>
        </Checkbox>
      )}
    </SidePanel>
  );
}

/** Getting paid: the payout accounts, the primary one first; add, make primary, retire. */
export function PayoutAccounts({ accounts, canManage }: { accounts: PayoutAccountView[] | null; canManage: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [retiring, setRetiring] = useState<PayoutAccountView | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const live = (accounts ?? []).filter((a) => a.status === "active");
  const shown = [...(accounts ?? [])].sort(
    (a, b) =>
      Number(b.isPrimary) - Number(a.isPrimary) || Number(a.status !== "active") - Number(b.status !== "active"),
  );

  const primary = (a: PayoutAccountView) => {
    setBusy(a.id);
    start(async () => {
      const result = await makePrimaryPayoutAccount(a.id);
      setBusy(null);
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      toast.success(`${a.destination} is now the primary account`);
      router.refresh();
    });
  };

  const retire = () => {
    if (!retiring) return;
    const a = retiring;
    start(async () => {
      const result = await retirePayoutAccount(a.id);
      if (!result.ok) {
        toast.danger(result.error);
        return;
      }
      setRetiring(null);
      toast.success("Account retired");
      router.refresh();
    });
  };

  return (
    <SectionCard
      title="Payout accounts"
      description="Where rent paid through Injishi goes. The primary account gets every payout."
      actions={
        canManage && live.length > 0 ? (
          <ActionButton icon="Plus" size="sm" onPress={() => setAdding(true)}>
            Add account
          </ActionButton>
        ) : null
      }
      contentClassName="gap-0"
    >
      {accounts === null ? (
        <EmptyBlock size="sm" icon="Lock" title="Only the owner sees where rent is paid out" />
      ) : shown.length === 0 || live.length === 0 ? (
        <EmptyBlock
          size="sm"
          icon="Wallet"
          title="No payout account yet"
          description="Rent paid through Injishi is held until you add one."
          action={
            canManage ? (
              <ActionButton icon="Plus" intent="primary" onPress={() => setAdding(true)}>
                Add account
              </ActionButton>
            ) : undefined
          }
        />
      ) : (
        <ListView aria-label="Payout accounts" variant="secondary" items={shown}>
          {(a) => (
            <ListView.Item id={a.id} textValue={a.destination} className="items-center">
              <ListView.ItemContent className="items-center gap-3">
                <Avatar size="sm" variant="soft" color={a.isPrimary ? "accent" : "default"} className="shrink-0">
                  <Avatar.Fallback>
                    <Icon name={KIND_ICON[a.kind]} />
                  </Avatar.Fallback>
                </Avatar>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <ListView.Title className="flex flex-wrap items-center gap-2 whitespace-normal tabular">
                    {a.destination}
                    {a.isPrimary ? (
                      <Chip size="sm" color="accent" variant="soft">
                        Primary
                      </Chip>
                    ) : null}
                    {a.status !== "active" ? (
                      <Chip size="sm" variant="soft">
                        Retired
                      </Chip>
                    ) : null}
                  </ListView.Title>
                  <ListView.Description className="whitespace-normal">
                    {a.accountName} · {PAYOUT_ACCOUNT_KIND_LABEL[a.kind]}
                  </ListView.Description>
                </span>
              </ListView.ItemContent>
              {canManage && a.status === "active" ? (
                <ListView.ItemAction>
                  <RowActions>
                    <IconAction
                      icon="Star"
                      label="Make primary"
                      disabledReason={a.isPrimary ? "It is the primary account" : null}
                      isPending={pending && busy === a.id}
                      onPress={() => primary(a)}
                    />
                    <IconAction icon="TrashBin" label="Retire" intent="danger" onPress={() => setRetiring(a)} />
                  </RowActions>
                </ListView.ItemAction>
              ) : null}
            </ListView.Item>
          )}
        </ListView>
      )}

      <AddAccountPanel isOpen={adding} onOpenChange={setAdding} firstAccount={live.length === 0} />
      <ConfirmDialog
        isOpen={retiring !== null}
        onOpenChange={(open) => (open ? undefined : setRetiring(null))}
        title="Retire this account?"
        confirmLabel="Retire account"
        confirmIcon="TrashBin"
        intent="danger"
        isPending={pending && retiring !== null}
        onConfirm={retire}
      >
        {retiring?.isPrimary
          ? live.length > 1
            ? `${retiring.destination} stops getting payouts. Your newest other account becomes the primary one.`
            : `${retiring.destination} stops getting payouts. Rent is held until you add another account.`
          : `${retiring?.destination ?? "This account"} stops being offered for payouts.`}
      </ConfirmDialog>
    </SectionCard>
  );
}
