"use client";

import { Chip } from "@heroui/react";
import { FileTree } from "@heroui-pro/react";
import type { SettingsBusinessNode } from "@injishi/data/fixtures/owner";
import { Icon, toneColor } from "@injishi/ui";
import { type ReactNode, useMemo, useState } from "react";

interface TreeEntry {
  node: SettingsBusinessNode;
  children: TreeEntry[];
}

/** Nest the ordered node list by depth (each node hangs under the closest shallower node before it). */
function nest(nodes: SettingsBusinessNode[]): TreeEntry[] {
  const roots: TreeEntry[] = [];
  const stack: TreeEntry[] = [];
  for (const node of nodes) {
    const entry = { node, children: [] };
    while (stack.length && (stack.at(-1)?.node.depth ?? 0) >= node.depth) stack.pop();
    const parent = stack.at(-1);
    if (parent) parent.children.push(entry);
    else roots.push(entry);
    stack.push(entry);
  }
  return roots;
}

function NodeTitle({ node }: { node: SettingsBusinessNode }) {
  return (
    <span className="flex w-full items-start gap-2 py-0.5 whitespace-normal">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`text-[13px] leading-[18px] ${node.depth < 3 ? "font-semibold" : "font-medium"}`}>
          {node.label}
        </span>
        <span className="text-xs leading-4 text-muted">{node.meta}</span>
      </span>
      {node.tag ? (
        <Chip size="sm" variant="soft" color={toneColor(node.tagTone)} className="shrink-0">
          {node.tag}
        </Chip>
      ) : null}
    </span>
  );
}

/**
 * The business hierarchy: tenant › legal entity › property › departments and outlets. Selecting a node opens it in the
 * right-hand panel; the Departments and Outlets groups only open and close.
 */
export function SettingsBusinessTree({
  nodes,
  selected,
  onSelect,
  labelledBy,
}: {
  nodes: SettingsBusinessNode[];
  selected: string;
  onSelect: (id: string) => void;
  labelledBy: string;
}) {
  const tree = useMemo(() => nest(nodes), [nodes]);
  const [expanded, setExpanded] = useState<Set<string>>(
    () =>
      new Set(
        nodes.filter((n) => (n.kind === "group" ? n.expanded : nodes.some((c) => c.depth > n.depth))).map((n) => n.id),
      ),
  );
  const isGroup = (id: string) => nodes.some((n) => n.id === id && n.kind === "group");
  const toggle = (id: string) =>
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const render = (e: TreeEntry): ReactNode => (
    <FileTree.Item
      key={e.node.id}
      id={e.node.id}
      textValue={e.node.label}
      title={<NodeTitle node={e.node} />}
      icon={e.node.kind === "group" ? undefined : <Icon name={e.node.icon} />}
    >
      {e.children.map(render)}
    </FileTree.Item>
  );

  return (
    <FileTree
      aria-labelledby={labelledBy}
      showGuideLines={false}
      selectionMode="single"
      selectionBehavior="replace"
      disallowEmptySelection
      selectedKeys={[selected]}
      onSelectionChange={(keys) => {
        if (keys === "all") return;
        const [k] = [...keys];
        if (k === undefined) return;
        if (isGroup(String(k))) toggle(String(k));
        else onSelect(String(k));
      }}
      expandedKeys={expanded}
      onExpandedChange={(keys) => setExpanded(new Set([...keys].map(String)))}
      className="p-0"
    >
      {tree.map(render)}
    </FileTree>
  );
}
