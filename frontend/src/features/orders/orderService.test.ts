import { describe, expect, it } from "vitest";
import { isPreviewHost } from "./orderService";

describe("ordering visibility host check", () => {
  it("treats preview and local hosts as test sites", () => {
    expect(isPreviewHost("hidden-spot-menu.preview.emergentagent.com")).toBe(true);
    expect(isPreviewHost("localhost")).toBe(true);
  });
  it("treats the published site as production (buttons hidden while in demo mode)", () => {
    expect(isPreviewHost("secretspot.emergent.host")).toBe(false);
    expect(isPreviewHost("www.secretspot.es")).toBe(false);
    expect(isPreviewHost("evil-preview.emergentagent.com.attacker.io")).toBe(false);
  });
});
