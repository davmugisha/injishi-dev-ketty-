import { EmptyState } from "@heroui-pro/react";

/** A live POS screen the person cannot use, in a sentence. */
export function PosBlocked({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Title>{title}</EmptyState.Title>
          <EmptyState.Description>{message}</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    </div>
  );
}
