"use client";

import { Alert, Checkbox, Description, FieldError, Input, Label, TextField } from "@heroui/react";
import {
  emailTypoMessage,
  expectedSignerName,
  type LeaseContractView,
  type SigningCodeSent,
  suggestEmailFix,
  typedNameProblem,
} from "@injishi/contracts";
import {
  ActionButton,
  ActionLink,
  CodeInput,
  FlowStepper,
  Icon,
  ResendCodeButton,
  SidePanel,
  SignaturePad,
  useResendTimer,
} from "@injishi/ui";
import { useRouter } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";
import type { ActionResult } from "@/server/rentals/action-kit";
import { ContractDocument } from "./ContractDocument";
import { contractOf } from "./shared";
import { uploadSignatureDrawing } from "./signing-actions";

const STEPS = [
  { id: "review", title: "Review" },
  { id: "sign", title: "Sign" },
  { id: "confirm", title: "Confirm" },
  { id: "done", title: "Done" },
];

export interface SignBody {
  typedName: string;
  signatureObjectKey?: string;
  code: string;
  documentHash: string;
  confirmEmail?: boolean;
}

/** The calls one side signs with: the landlord's in the business, the tenant's as the person. */
export interface SigningCalls {
  requestCode: () => Promise<ActionResult<SigningCodeSent>>;
  reload: () => Promise<ActionResult<LeaseContractView>>;
  sign: (body: SignBody) => Promise<ActionResult<unknown>>;
}

function Problem({ children }: { children: ReactNode }) {
  return (
    <Alert status="danger">
      <Alert.Indicator>
        <Icon name="CircleExclamation" />
      </Alert.Indicator>
      <Alert.Content>
        <Alert.Title className="text-sm">{children}</Alert.Title>
      </Alert.Content>
    </Alert>
  );
}

/**
 * Review and sign a lease (WP 2.5, P3.2), the same for both sides: read the contract and say so, type the
 * full name as the contract states it (the binding signature) and, if wanted, draw one, then confirm with
 * the 6 digit code emailed to the signer. The signature names the contract's fingerprint; a contract
 * that changed meanwhile is read again before anything is signed. A side panel, from the right on a
 * desktop and as a bottom sheet on a phone.
 */
export function SigningPanel({
  side: role,
  view,
  reference,
  calls,
  pdfHref,
  onClose,
  onSigned,
}: {
  /** Whose signature this is. */
  side: "landlord" | "tenant";
  view: LeaseContractView;
  /** "Lease L-0002 · Unit A-02". */
  reference: string;
  calls: SigningCalls;
  /** The signed copy (or the marked preview while it is being made). */
  pdfHref: string;
  onClose: () => void;
  onSigned?: () => void;
}) {
  const router = useRouter();
  const [contractView, setContractView] = useState(view);
  const contract = contractOf(contractView);
  const [step, setStep] = useState(0);
  const [read, setRead] = useState(false);
  const [emailRight, setEmailRight] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [drawing, setDrawing] = useState<string | null>(null);
  const uploaded = useRef<{ png: string; key: string } | null>(null);
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<SigningCodeSent | null>(null);
  const timer = useResendTimer(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState<null | "code" | "sign" | "reload">(null);

  // The landlord's signature sends the invitation: an address that looks like a slip is confirmed first.
  const tenantEmail = contract?.parties.tenant.email ?? "";
  const emailFix = role === "landlord" && tenantEmail ? suggestEmailFix(tenantEmail) : null;
  const expected = contract ? expectedSignerName(contract, role) : "";

  const askForCode = async () => {
    setBusy("code");
    setProblem(null);
    const result = await calls.requestCode();
    setBusy(null);
    if (!result.ok) {
      setProblem(result.error);
      return false;
    }
    setSent(result.value);
    timer.restart(result.value.resendInSeconds);
    return true;
  };

  const toConfirm = async () => {
    if (!contract) return;
    const nameProblem = typedNameProblem(typedName, contract, role);
    if (nameProblem) {
      setErrors({ typedName: nameProblem });
      return;
    }
    setErrors({});
    // A code still good from a moment ago is used again; the API answers `sent: false` for it.
    if (await askForCode()) setStep(2);
  };

  const readAgain = async () => {
    setBusy("reload");
    const result = await calls.reload();
    setBusy(null);
    if (!result.ok) {
      setProblem(result.error);
      return;
    }
    setContractView(result.value);
    // The page behind the panel shows the lease as it stands now, too.
    router.refresh();
    setChanged(false);
    setRead(false);
    setCode("");
    setProblem(null);
    setStep(0);
  };

  const sign = async (entered: string = code) => {
    if (!contract || busy) return;
    if (!/^\d{6}$/.test(entered.trim())) {
      setErrors({ code: "Enter the 6 digit code from your email." });
      return;
    }
    setBusy("sign");
    setErrors({});
    setProblem(null);
    let signatureObjectKey: string | undefined;
    if (drawing) {
      if (uploaded.current?.png !== drawing) {
        const saved = await uploadSignatureDrawing(drawing);
        if (!saved.ok) {
          setBusy(null);
          setErrors({ drawing: saved.error });
          setStep(1);
          return;
        }
        uploaded.current = { png: drawing, key: saved.value.objectKey };
      }
      signatureObjectKey = uploaded.current.key;
    }
    const result = await calls.sign({
      typedName: typedName.trim(),
      ...(signatureObjectKey ? { signatureObjectKey } : {}),
      code: entered.trim(),
      documentHash: contractView.version.contentHash,
      ...(emailFix && emailRight ? { confirmEmail: true } : {}),
    });
    setBusy(null);
    if (result.ok) {
      setStep(3);
      onSigned?.();
      return;
    }
    if (result.code === "contract_changed") {
      setChanged(true);
      return;
    }
    const fields = result.fieldErrors ?? {};
    if (fields.typedName) {
      setErrors({ typedName: fields.typedName });
      setStep(1);
    } else if (fields.signatureObjectKey) {
      uploaded.current = null;
      setErrors({ drawing: fields.signatureObjectKey });
      setStep(1);
    } else if (fields["tenant.email"]) {
      setErrors({ email: fields["tenant.email"] });
      setStep(0);
    } else if (fields.code) {
      setErrors({ code: fields.code });
      setCode("");
    } else {
      setProblem(result.error);
    }
  };

  const reviewReady = read && (!emailFix || emailRight);
  const footer =
    step === 3 ? (
      <ActionButton intent="primary" onPress={onClose}>
        Done
      </ActionButton>
    ) : (
      <>
        {step === 0 ? (
          <ActionButton onPress={onClose}>Cancel</ActionButton>
        ) : (
          <ActionButton
            icon="ArrowLeft"
            intent="ghost"
            onPress={() => {
              setProblem(null);
              setStep(step - 1);
            }}
            isDisabled={busy !== null}
          >
            Back
          </ActionButton>
        )}
        {step === 0 ? (
          <ActionButton
            intent="primary"
            icon="ArrowRight"
            iconPlacement="end"
            isDisabled={!reviewReady || !contract}
            onPress={() => setStep(1)}
          >
            Continue
          </ActionButton>
        ) : step === 1 ? (
          <ActionButton
            intent="primary"
            icon="ArrowRight"
            iconPlacement="end"
            isPending={busy === "code"}
            onPress={toConfirm}
          >
            Continue
          </ActionButton>
        ) : (
          <ActionButton
            intent="primary"
            icon="FileCheck"
            isPending={busy === "sign"}
            isDisabled={changed}
            onPress={() => sign()}
          >
            Sign the lease
          </ActionButton>
        )}
      </>
    );

  return (
    <SidePanel
      isOpen
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={step === 3 ? "Signed" : "Review and sign"}
      description={reference}
      size="lg"
      isPending={busy === "sign"}
      footer={footer}
    >
      <FlowStepper label="Signing steps" steps={STEPS} current={step === 3 ? 4 : step} orientation="horizontal" />
      {problem ? <Problem>{problem}</Problem> : null}
      {changed ? (
        <Alert status="warning">
          <Alert.Indicator>
            <Icon name="TriangleExclamation" />
          </Alert.Indicator>
          <Alert.Content className="gap-2">
            <Alert.Title className="text-sm">The contract changed</Alert.Title>
            <Alert.Description className="text-xs">
              Something it names changed since you opened it. Read it again, then sign.
            </Alert.Description>
            <ActionButton
              icon="ArrowsRotateRight"
              size="sm"
              className="self-start"
              isPending={busy === "reload"}
              onPress={readAgain}
            >
              Read it again
            </ActionButton>
          </Alert.Content>
        </Alert>
      ) : null}

      {!contract ? (
        <Problem>This contract cannot be signed on Injishi. Ask for it to be sent again.</Problem>
      ) : step === 0 ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-separator p-4">
            <ContractDocument contract={contract} />
          </div>
          {emailFix ? (
            <Alert status="warning">
              <Alert.Indicator>
                <Icon name="TriangleExclamation" />
              </Alert.Indicator>
              <Alert.Content className="gap-2">
                <Alert.Title className="text-sm">
                  The invitation goes to {tenantEmail}. {emailTypoMessage(emailFix)}
                </Alert.Title>
                <Alert.Description className="text-xs">
                  Change it with Edit, or confirm it is right as typed.
                </Alert.Description>
                <Checkbox isSelected={emailRight} onChange={setEmailRight}>
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Checkbox.Content>
                    <Label className="text-sm">The email is right as typed</Label>
                  </Checkbox.Content>
                </Checkbox>
              </Alert.Content>
            </Alert>
          ) : null}
          {errors.email ? <Problem>{errors.email}</Problem> : null}
          <Checkbox isSelected={read} onChange={setRead}>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Content>
              <Label className="text-sm">I have read the whole contract</Label>
              <Description className="text-xs">
                Contract version {contractView.version.version}, fingerprint{" "}
                <span className="font-mono">{contractView.version.contentHash.slice(0, 12)}</span>
              </Description>
            </Checkbox.Content>
          </Checkbox>
        </div>
      ) : step === 1 ? (
        <div className="flex flex-col gap-4">
          <TextField
            name="typedName"
            value={typedName}
            onChange={(v) => {
              setTypedName(v);
              if (errors.typedName) setErrors({});
            }}
            isInvalid={errors.typedName ? true : undefined}
            fullWidth
            autoFocus
            className="gap-1"
          >
            <Label>Type your full name</Label>
            <Input placeholder={expected} autoComplete="name" />
            <Description>Your signature. As the contract states it: {expected}</Description>
            <FieldError>{errors.typedName}</FieldError>
          </TextField>
          <SignaturePad
            label="Draw your signature"
            description="Optional. It is printed beside your typed name."
            onChange={(png) => {
              setDrawing(png);
              if (errors.drawing) setErrors({});
            }}
            errorMessage={errors.drawing}
          />
        </div>
      ) : step === 2 ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-pretty text-muted">
            {sent
              ? sent.sent
                ? `We emailed a 6 digit code to ${sent.sentTo}. It works for ${Math.round(sent.expiresInSeconds / 60)} minutes.`
                : `Use the code we emailed to ${sent.sentTo} a moment ago.`
              : "Sending you a code…"}
          </p>
          <CodeInput
            value={code}
            onChange={(v) => {
              setCode(v);
              if (errors.code) setErrors({});
            }}
            onComplete={(v) => sign(v)}
            errorMessage={errors.code}
            isDisabled={busy === "sign" || changed}
            autoFocus
          />
          <ResendCodeButton timer={timer} onResend={askForCode} isPending={busy === "code"} className="self-start" />
        </div>
      ) : (
        <div className="flex flex-col items-start gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-success-soft text-success">
              <Icon name="CircleCheck" className="size-5" />
            </span>
            <div className="flex flex-col">
              <span className="font-semibold">You signed as {typedName.trim()}</span>
              <span className="text-sm text-muted">
                {role === "landlord"
                  ? "The tenant has been emailed a link to read and sign."
                  : "Both of you have signed. The signed copy goes to you both by email."}
              </span>
            </div>
          </div>
          <ActionLink href={pdfHref} target="_blank" rel="noopener" icon="FileArrowDown">
            {role === "landlord" ? "Open the PDF" : "Open the signed PDF"}
          </ActionLink>
        </div>
      )}
    </SidePanel>
  );
}
