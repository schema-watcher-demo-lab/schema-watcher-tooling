import { describe, expect, it } from "vitest";
import { countBreakingChanges } from "../src/breaking";

describe("countBreakingChanges", () => {
  it("counts breaking change types consistently with app classification", () => {
    expect(
      countBreakingChanges([
        { table: "users", changeType: "COLUMN_DEFAULT_CHANGED" },
        { table: "users", changeType: "COLUMN_RENAMED" },
        { table: "users", changeType: "TABLE_ADDED" },
      ]),
    ).toBe(2);
  });
});
