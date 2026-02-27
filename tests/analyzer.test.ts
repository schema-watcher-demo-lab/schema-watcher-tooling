import { describe, expect, it } from "vitest";
import { analyzeChanges } from "../src/analyzer";

describe("analyzer", () => {
  it("emits column additions for newly added tables", () => {
    const changes = analyzeChanges(
      [],
      [
        {
          name: "Product",
          columns: {
            id: { type: "String", nullable: false },
            priceCents: { type: "Int", nullable: false },
            currency: { type: "String", nullable: false },
          },
        },
      ]
    );

    expect(changes).toEqual(
      expect.arrayContaining([
        { table: "Product", changeType: "TABLE_ADDED" },
        { table: "Product", changeType: "COLUMN_ADDED", column: "id", newType: "String" },
        { table: "Product", changeType: "COLUMN_ADDED", column: "priceCents", newType: "Int" },
        { table: "Product", changeType: "COLUMN_ADDED", column: "currency", newType: "String" },
      ])
    );
  });
});
