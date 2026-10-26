"use client";

import {
  ArrowUpRightFromSquare,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileExclamation,
  FileText,
  Magnifier,
} from "@gravity-ui/icons";
import { Button, Card, Description, Label, Table, ToggleButton } from "@heroui/react";
import { EmptyState, RadioButtonGroup } from "@heroui-pro/react";
import type { CaseFile, FieldResult, Tone } from "@injishi/data/fixtures/oversight";
import { GateChip } from "@injishi/ui";
import { useState } from "react";
import { CardHeading, ToneChip } from "./shared";

const RESULT: Record<FieldResult, { label: string; tone: Tone }> = {
  match: { label: "Matches", tone: "success" },
  check: { label: "Check", tone: "warning" },
  unreadable: { label: "Not readable", tone: "danger" },
  undeclared: { label: "Not declared", tone: "default" },
};

/** Submitted documents: pick a document, page through its watermarked preview and compare its fields. */
export function CaseDocuments({ file }: { file: CaseFile }) {
  const [docId, setDocId] = useState(file.lastViewed.document);
  const [page, setPage] = useState(file.lastViewed.page);
  const [zoom, setZoom] = useState(false);
  const doc = file.documents.find((d) => d.id === docId) ?? file.documents[0];

  if (!doc) {
    return (
      <Card render={(p) => <section {...p} />} aria-labelledby="docs-h" className="gap-3.5 p-[18px]">
        <Card.Header>
          <CardHeading id="docs-h">Submitted Documents</CardHeading>
          <Card.Description>Nothing was uploaded with this registration</Card.Description>
        </Card.Header>
        <EmptyState size="sm">
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <FileText />
            </EmptyState.Media>
            <EmptyState.Title>No documents to read</EmptyState.Title>
            <EmptyState.Description>
              The business attached no certificate. Check what you need on the field visit, and reject with a reason if
              a document the law requires is missing.
            </EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      </Card>
    );
  }

  const current = Math.min(page, doc.pages);
  const unreadable = doc.unreadablePage === current;
  const live = doc.url !== undefined;

  return (
    <Card render={(p) => <section {...p} />} aria-labelledby="docs-h" className="gap-3.5 p-[18px]">
      <Card.Header className="flex flex-row items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <CardHeading id="docs-h">Submitted Documents</CardHeading>
          <Card.Description>
            {live
              ? "Open each file and read it · the link is signed for you and expires shortly"
              : "View only · watermarked with your name · downloads off for this mandate"}
          </Card.Description>
        </div>
        <GateChip icon={<Eye className="size-3" />}>Each view is logged</GateChip>
      </Card.Header>

      <div className="flex flex-wrap items-start gap-3.5">
        <RadioButtonGroup
          aria-label="Documents"
          value={doc.id}
          onChange={(v) => {
            setDocId(v);
            setPage(1);
          }}
          className="flex min-w-0 flex-[1_1_230px] flex-col gap-2"
        >
          {file.documents.map((d) => (
            <RadioButtonGroup.Item key={d.id} value={d.id} className="w-full gap-2.5 px-4 py-3.5">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-default">
                <FileText className="size-4" aria-hidden="true" />
              </span>
              <RadioButtonGroup.ItemContent className="gap-0.5">
                <Label className="font-medium">{d.name}</Label>
                <Description className="text-[12px] leading-4">{d.issuerShort}</Description>
              </RadioButtonGroup.ItemContent>
              <ToneChip tone={d.statusTone} className="self-end">
                {d.status}
              </ToneChip>
            </RadioButtonGroup.Item>
          ))}
        </RadioButtonGroup>

        <div className="flex min-w-0 flex-[999_1_360px] flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">{doc.name}</span>
              <span className="text-[12px] leading-4 text-muted tabular">
                {doc.issuer} · {doc.number}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              aria-label="Previous page"
              isDisabled={current <= 1}
              onPress={() => setPage(Math.max(1, current - 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-[12px] whitespace-nowrap text-muted tabular" aria-live="polite">
              Page {current} of {doc.pages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              aria-label="Next page"
              isDisabled={current >= doc.pages}
              onPress={() => setPage(Math.min(doc.pages, current + 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
            <ToggleButton
              variant="ghost"
              size="sm"
              isIconOnly
              aria-label="Zoom in"
              isSelected={zoom}
              onChange={setZoom}
              isDisabled={unreadable}
            >
              <Magnifier className="size-4" />
            </ToggleButton>
          </div>

          <div className="relative flex h-[230px] items-center justify-center overflow-hidden rounded-[14px] bg-surface-secondary">
            {live ? (
              doc.url ? (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 pb-6 text-center font-medium text-accent no-underline hover:underline"
                >
                  <ArrowUpRightFromSquare className="size-6" aria-hidden="true" />
                  Open the {doc.name.toLowerCase()}
                  <span className="text-[12px] font-normal text-muted">{doc.file} · opening it is logged</span>
                </a>
              ) : (
                <EmptyState size="sm" className="pb-6">
                  <EmptyState.Header>
                    <EmptyState.Media variant="icon">
                      <FileExclamation />
                    </EmptyState.Media>
                    <EmptyState.Title>No file on record</EmptyState.Title>
                    <EmptyState.Description>
                      The certificate is declared but its file is not stored. Ask for it on the field visit.
                    </EmptyState.Description>
                  </EmptyState.Header>
                </EmptyState>
              )
            ) : unreadable ? (
              <EmptyState size="sm" className="pb-6">
                <EmptyState.Header>
                  <EmptyState.Media variant="icon">
                    <FileExclamation />
                  </EmptyState.Media>
                  <EmptyState.Title>Page {current} is not readable</EmptyState.Title>
                  <EmptyState.Description>
                    The scan is blurred. Request a clear copy rather than guessing the licence conditions.
                  </EmptyState.Description>
                </EmptyState.Header>
              </EmptyState>
            ) : (
              <div
                role="img"
                aria-label={`Preview of ${doc.name}, page ${current}`}
                className={`flex h-[220px] w-[170px] flex-col gap-2 rounded-md bg-surface px-3.5 py-4 shadow-surface transition-transform ${zoom ? "scale-125" : ""}`}
              >
                <span className="block h-2.5 w-[55%] rounded-[3px] bg-separator" />
                <span className="block h-1.5 w-[85%] rounded-[3px] bg-separator" />
                <span className="block h-1.5 w-[70%] rounded-[3px] bg-separator" />
                <span className="block h-[22px]" />
                <span className="block h-1.5 w-[90%] rounded-[3px] bg-separator" />
                <span className="block h-1.5 w-[80%] rounded-[3px] bg-separator" />
                <span className="block h-1.5 w-[60%] rounded-[3px] bg-separator" />
                <span className="flex-1" />
                <span className="block size-7 self-end rounded-full bg-separator" />
              </div>
            )}
            <div
              className="absolute inset-x-3 bottom-2.5 flex justify-between gap-3 text-[11px] leading-4 text-muted"
              hidden={live}
            >
              <span className="truncate">
                {doc.file} · uploaded {doc.uploaded}
              </span>
              <span className="shrink-0">
                Viewed by {file.lastViewed.by} · {file.lastViewed.at}
              </span>
            </div>
          </div>

          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label={`${doc.name} fields`}>
                <Table.Header>
                  <Table.Column isRowHeader>Field</Table.Column>
                  <Table.Column>On the document</Table.Column>
                  <Table.Column>Declared</Table.Column>
                  <Table.Column>Result</Table.Column>
                </Table.Header>
                <Table.Body>
                  {doc.fields.map((f) => (
                    <Table.Row key={f.label} id={f.label}>
                      <Table.Cell className="text-muted">{f.label}</Table.Cell>
                      <Table.Cell>{f.onDocument}</Table.Cell>
                      <Table.Cell>{f.declared}</Table.Cell>
                      <Table.Cell>
                        <ToneChip tone={RESULT[f.result].tone}>{RESULT[f.result].label}</ToneChip>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Content>
            </Table.ScrollContainer>
          </Table>
        </div>
      </div>
    </Card>
  );
}
