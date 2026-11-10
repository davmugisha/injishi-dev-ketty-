import { EmptyState } from "@heroui-pro/react";
import { PosFirstOutlet } from "./pos-first-outlet";

/** A live POS screen the person cannot use, in a sentence. */
export function PosBlocked({ title, message, firstOutlet }: { title: string; message: string; firstOutlet?: boolean }) {
  if (firstOutlet) return <PosFirstOutlet />;
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
