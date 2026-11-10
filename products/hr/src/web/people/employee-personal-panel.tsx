"use client";

import { Alert, Skeleton } from "@heroui/react";
import { KeyValueList } from "@injishi/ui";
import { useEffect, useState } from "react";
import type { EmployeePersonalView } from "../../model/people.ts";
import { useHrActions } from "../mount.tsx";

/**
 * A file's personal details as HR put them on file: birth, identity, contacts, where the person lives, family
 * and who to call. Read when the tab opens; only someone who keeps staff files sees them.
 */
export function EmployeePersonalPanel({ employeeId }: { employeeId: string }) {
  const { loadEmployeePersonal } = useHrActions();
  const [view, setView] = useState<EmployeePersonalView | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setView(null);
    setFailure(null);
    void loadEmployeePersonal(employeeId)
      .then((r) => {
        if (!live) return;
        if (r.ok) setView(r.personal);
        else setFailure(r.error);
      })
      .catch(() => live && setFailure("The personal details could not be loaded. Try again."));
    return () => {
      live = false;
    };
  }, [employeeId, loadEmployeePersonal]);

  if (failure) {
    return (
      <Alert status="danger">
        <Alert.Content>
          <Alert.Title>{failure}</Alert.Title>
        </Alert.Content>
      </Alert>
    );
  }
  if (!view) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-busy="true" aria-label="Loading personal details">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-5 w-full rounded-md" />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <KeyValueList items={view.rows.map((r) => ({ label: r.label, value: r.value }))} />
      {view.full ? null : (
        <p className="text-xs text-muted">Only people who manage staff files see birth, ID, address and family.</p>
      )}
    </div>
  );
}
