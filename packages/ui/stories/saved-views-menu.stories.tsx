import * as React from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { SavedView } from "@injishi/contracts";

import { SavedViewsMenu } from "../src/components/saved-views-menu";

/** Saved views: the caller's own and the shared ones. Sample views only. */
const VIEWS: SavedView[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    listKey: "sample.staff",
    name: "Kitchen, this week",
    config: { filters: [], sort: [], pageSize: 25, view: "list" },
    shared: false,
    isDefault: true,
    mine: true,
    authorName: null,
    updatedAt: "2026-10-01T08:00:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    listKey: "sample.staff",
    name: "Night shift",
    config: { filters: [], sort: [], pageSize: 25, view: "card" },
    shared: true,
    isDefault: false,
    mine: false,
    authorName: "Habimana Olivier",
    updatedAt: "2026-09-28T17:30:00.000Z",
  },
];

function Menu({ views = VIEWS, nameTaken = false }: { views?: SavedView[] | undefined; nameTaken?: boolean }) {
  const [active, setActive] = React.useState<string | null>(views?.[0]?.id ?? null);
  return (
    <SavedViewsMenu
      views={views}
      activeId={active}
      onOpen={(view) => setActive(view.id)}
      onSave={async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (nameTaken) throw new Error("You already have a view with that name.");
      }}
      onOverwrite={async () => undefined}
      onSetDefault={async () => undefined}
      onDelete={async () => setActive(null)}
    />
  );
}

const meta = {
  title: "Lists/SavedViewsMenu",
  component: Menu,
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** No views yet. */
export const Empty: Story = { args: { views: [] } };

/** Saving a name already taken shows the server's reason in the form. */
export const NameTaken: Story = { args: { nameTaken: true } };
