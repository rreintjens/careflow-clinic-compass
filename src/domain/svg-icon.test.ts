import { describe, expect, it } from "vitest";
import { svgIconError } from "./svg-icon";

describe("svgIconError", () => {
  it("accepts a plain line icon", () => {
    expect(svgIconError('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4h16"/></svg>')).toBeNull();
  });
  it("refuses scripts", () => {
    expect(svgIconError("<svg><script>alert(1)</script></svg>")).not.toBeNull();
  });
  it("refuses event handlers", () => {
    expect(svgIconError('<svg onload="x()"><path/></svg>')).not.toBeNull();
  });
  it("refuses external references", () => {
    expect(svgIconError('<svg><image href="https://x.test/a.png"/></svg>')).not.toBeNull();
  });
  it("refuses non-svg files", () => {
    expect(svgIconError("<html></html>")).toBe("Dit is geen SVG-bestand");
  });
});
