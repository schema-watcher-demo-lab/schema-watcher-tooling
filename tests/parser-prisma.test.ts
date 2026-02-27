import { describe, expect, it } from "vitest";
import { parsePrisma } from "../src/parser/prisma";

describe("parsePrisma", () => {
  it("ignores Prisma field attributes and only captures declared columns", () => {
    const schema = `
      model Product {
        id         String @id @default(cuid())
        sku        String @unique
        priceCents Int
        currency   String @default("USD")
      }
    `;

    const tables = parsePrisma(schema);
    expect(tables).toHaveLength(1);
    expect(Object.keys(tables[0].columns).sort()).toEqual([
      "currency",
      "id",
      "priceCents",
      "sku",
    ]);
  });
});
