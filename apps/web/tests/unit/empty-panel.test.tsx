import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { EmptyPanel } from "@/components/app/empty-panel";

describe("EmptyPanel", () => {
  test("says what would fill the screen: a heading and the reason it is empty", () => {
    render(
      <EmptyPanel icon="calendar" title="No trips yet">
        Stays you book appear here.
      </EmptyPanel>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "No trips yet" })).toBeInTheDocument();
    expect(screen.getByText("Stays you book appear here.")).toBeInTheDocument();
  });

  test("with no action there is nothing to follow", () => {
    render(
      <EmptyPanel icon="calendar" title="No trips yet">
        Stays you book appear here.
      </EmptyPanel>,
    );
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  test("an action is a real link to its address, not a button that navigates", () => {
    render(
      <EmptyPanel icon="calendar" title="No trips yet" action={{ label: "Explore stays", href: "/explore" }}>
        Stays you book appear here.
      </EmptyPanel>,
    );
    expect(screen.getByRole("link", { name: "Explore stays" })).toHaveAttribute("href", "/explore");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
