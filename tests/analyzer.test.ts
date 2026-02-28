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

  it("emits old/new nullable flags for nullable changes", () => {
    const changes = analyzeChanges(
      [
        {
          name: "User",
          columns: {
            email: { type: "String", nullable: false },
          },
        },
      ],
      [
        {
          name: "User",
          columns: {
            email: { type: "String", nullable: true },
          },
        },
      ]
    );

    expect(changes).toEqual([
      {
        table: "User",
        changeType: "COLUMN_NULLABLE_CHANGED",
        column: "email",
        oldNullable: false,
        newNullable: true,
      },
    ]);
  });

  it("emits default changes when column defaults differ", () => {
    const changes = analyzeChanges(
      [
        {
          name: "User",
          columns: {
            plan: { type: "String", nullable: false, default: "free" },
          },
        },
      ],
      [
        {
          name: "User",
          columns: {
            plan: { type: "String", nullable: false, default: "pro" },
          },
        },
      ]
    );

    expect(changes).toEqual([
      {
        table: "User",
        changeType: "COLUMN_DEFAULT_CHANGED",
        column: "plan",
        oldDefault: "free",
        newDefault: "pro",
      },
    ]);
  });
});
