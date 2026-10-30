import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GateChip, KeyValueList, PageHeader, SectionHeader, StatusDot } from "../../src/layout.tsx";

describe("PageHeader", () => {
  test("the title is the page's one top level heading", () => {
    render(<PageHeader title="Front desk" />);
    expect(screen.getByRole("heading", { level: 1, name: "Front desk" })).toBeInTheDocument();
  });

  test("eyebrow, description and actions render only when given", () => {
    const { container, rerender } = render(<PageHeader title="Front desk" />);
    expect(container.querySelectorAll("p")).toHaveLength(0);

    rerender(
      <PageHeader
        eyebrow="Tuesday"
        title="Front desk"
        description="Arrivals and departures"
        actions={<button type="button">New booking</button>}
      />,
    );
    expect(screen.getByText("Tuesday")).toBeInTheDocument();
    expect(screen.getByText("Arrivals and departures")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New booking" })).toBeInTheDocument();
  });
});

describe("SectionHeader", () => {
  test("is a second level heading carrying the id a section points aria-labelledby at", () => {
    render(
      <section aria-labelledby="arrivals">
        <SectionHeader id="arrivals" title="Arrivals" description="Due in today" />
      </section>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Arrivals" })).toHaveAttribute("id", "arrivals");
    expect(screen.getByRole("region", { name: "Arrivals" })).toBeInTheDocument();
    expect(screen.getByText("Due in today")).toBeInTheDocument();
  });
});

describe("KeyValueList", () => {
  test("each pair is a term and its definition, in order", () => {
    render(
      <KeyValueList
        items={[
          { label: "Room", value: "204" },
          { label: "Guests", value: "2 adults" },
        ]}
      />,
    );
    expect(screen.getAllByRole("term").map((node) => node.textContent)).toEqual(["Room", "Guests"]);
    expect(screen.getAllByRole("definition").map((node) => node.textContent)).toEqual(["204", "2 adults"]);
  });
});

describe("StatusDot", () => {
  test("is hidden from assistive technology and painted from the tone's role", () => {
    const { container } = render(<StatusDot tone="danger" />);
    const dot = container.querySelector("span");
    expect(dot).toHaveAttribute("aria-hidden", "true");
    expect(dot).toHaveClass("bg-danger");
  });
});

describe("GateChip", () => {
  test("renders its label through HeroUI's Chip, beside its icon", () => {
    render(<GateChip icon={<svg data-testid="gate-icon" />}>Night audit</GateChip>);
    const label = screen.getByText("Night audit");
    expect(label.parentElement).toContainElement(screen.getByTestId("gate-icon"));
  });
});
