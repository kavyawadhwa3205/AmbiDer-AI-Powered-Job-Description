import { describe, expect, it } from "vitest";
import API_BASE_URL from "./config";

describe("API configuration", () => {
  it("uses a non-empty API base URL", () => {
    expect(API_BASE_URL).toBeTruthy();
  });

  it("defaults to the same-origin API path when no public URL is configured", () => {
    if (!import.meta.env.VITE_API_URL) {
      expect(API_BASE_URL).toBe("/api");
    }
  });
});
