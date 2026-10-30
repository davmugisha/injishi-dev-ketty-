import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { QrCode } from "@/components/shared/qr-code";

/**
 * The shared QR code: the receipt's verification code and, since mobile spec 0004, the downloads
 * page's `/get` code. Each caller passes its own light and ink; what must hold for both is that the
 * quiet zone is painted, never transparent, so the symbol scans on a dark ground too.
 */
function draw(value = "https://injishi.com/get") {
  return render(<QrCode value={value} size={140} light="var(--white)" ink="var(--ink)" label="QR code to test" />);
}

describe("QrCode", () => {
  test("is one image, named by its label", () => {
    draw();
    expect(screen.getByRole("img", { name: "QR code to test" })).toBeInTheDocument();
  });

  test("draws at the pixel size asked", () => {
    draw();
    const svg = screen.getByRole("img");

    expect(svg).toHaveAttribute("width", "140");
    expect(svg).toHaveAttribute("height", "140");
  });

  test("paints the whole symbol, quiet zone included, in the light colour it is given", () => {
    draw();
    const svg = screen.getByRole("img");
    const [, , width, height] = (svg.getAttribute("viewBox") ?? "").split(" ");
    const ground = svg.querySelector("rect");

    expect(ground).toHaveAttribute("fill", "var(--white)");
    expect(ground).toHaveAttribute("width", width);
    expect(ground).toHaveAttribute("height", height);
  });

  test("draws the modules in the ink it is given", () => {
    draw();
    expect(screen.getByRole("img").querySelector("path")).toHaveAttribute("fill", "var(--ink)");
  });

  test("the same value always draws the same symbol, and another value another", () => {
    const symbol = (value: string) => draw(value).container.querySelector("path")?.getAttribute("d");

    expect(symbol("https://injishi.com/get")).toBe(symbol("https://injishi.com/get"));
    expect(symbol("https://injishi.com/get")).not.toBe(symbol("https://injishi.com/downloads"));
  });
});
