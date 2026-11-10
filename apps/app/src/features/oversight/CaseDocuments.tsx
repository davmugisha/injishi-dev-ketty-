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
import { useTranslations } from "next-intl";
import { CardHeading, ToneChip } from "./shared";

const RESULT: Record<FieldResult, { tone: Tone }> = {
  match: { tone: "success" },
  check: { tone: "warning" },
  unreadable: { tone: "danger" },
  undeclared: { tone: "default" },
};

/** Submitted documents: pick a document, page through its watermarked preview and compare its fields. */
export function CaseDocuments({ file }: { file: CaseFile }) {
  const t = useTranslations("officialReview.documents");
  const [docId, setDocId] = useState(file.lastViewed.document);
  const [page, setPage] = useState(file.lastViewed.page);
  const [zoom, setZoom] = useState(false);
  const doc = file.documents.find((d) => d.id === docId) ?? file.documents[0];

  if (!doc) {
    return (
      <Card render={(p) => <section {...p} />} aria-labelledby="docs-h" className="gap-3.5 p-[18px]">
        <Card.Header>
          <CardHeading id="docs-h">{t("title")}</CardHeading>
          <Card.Description>{t("nothingUploaded")}</Card.Description>
        </Card.Header>
        <EmptyState size="sm">
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <FileText />
            </EmptyState.Media>
            <EmptyState.Title>{t("emptyTitle")}</EmptyState.Title>
            <EmptyState.Description>
              {t("emptyDescription")}
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
          <CardHeading id="docs-h">{t("title")}</CardHeading>
          <Card.Description>
            {live
              ? t("liveDescription")
              : t("sampleDescription")}
          </Card.Description>
        </div>
        <GateChip icon={<Eye className="size-3" />}>{t("eachViewLogged")}</GateChip>
      </Card.Header>

      <div className="flex flex-wrap items-start gap-3.5">
        <RadioButtonGroup
          aria-label={t("title")}
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
              aria-label={t("previous")}
              isDisabled={current <= 1}
              onPress={() => setPage(Math.max(1, current - 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-[12px] whitespace-nowrap text-muted tabular" aria-live="polite">
              {t("page", { current, total: doc.pages })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              isIconOnly
              aria-label={t("next")}
              isDisabled={current >= doc.pages}
              onPress={() => setPage(Math.min(doc.pages, current + 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
            <ToggleButton
              variant="ghost"
              size="sm"
              isIconOnly
              aria-label={t("zoom")}
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
                  {t("openFile", { file: doc.name.toLowerCase() })}
                  <span className="text-[12px] font-normal text-muted">{doc.file} · {t("openingLogged")}</span>
                </a>
              ) : (
                <EmptyState size="sm" className="pb-6">
                  <EmptyState.Header>
                    <EmptyState.Media variant="icon">
                      <FileExclamation />
                    </EmptyState.Media>
                    <EmptyState.Title>{t("noFile")}</EmptyState.Title>
                    <EmptyState.Description>
                      {t("declaredFileMissing")}
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
                  <EmptyState.Title>{t("unreadable", { page: current })}</EmptyState.Title>
                  <EmptyState.Description>
                    {t("blurred")}
                  </EmptyState.Description>
                </EmptyState.Header>
              </EmptyState>
            ) : (
              <div
                role="img"
                aria-label={`${doc.name}, ${t("page", { current, total: doc.pages })}`}
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
                {doc.file} · {t("uploaded", { date: doc.uploaded })}
              </span>
              <span className="shrink-0">
                {t("viewedBy", { name: file.lastViewed.by })} · {file.lastViewed.at}
              </span>
            </div>
          </div>

          <Table>
            <Table.ScrollContainer>
              <Table.Content aria-label={t("fields", { document: doc.name })}>
                <Table.Header>
                  <Table.Column isRowHeader>{t("field")}</Table.Column>
                  <Table.Column>{t("onDocument")}</Table.Column>
                  <Table.Column>{t("declared")}</Table.Column>
                  <Table.Column>{t("result")}</Table.Column>
                </Table.Header>
                <Table.Body>
                  {doc.fields.map((f) => (
                    <Table.Row key={f.label} id={f.label}>
                      <Table.Cell className="text-muted">{f.label}</Table.Cell>
                      <Table.Cell>{f.onDocument}</Table.Cell>
                      <Table.Cell>{f.declared}</Table.Cell>
                      <Table.Cell>
                        <ToneChip tone={RESULT[f.result].tone}>{f.result === "match" ? t("matches") : f.result === "check" ? t("check") : f.result === "unreadable" ? t("notReadable") : t("notDeclared")}</ToneChip>
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
