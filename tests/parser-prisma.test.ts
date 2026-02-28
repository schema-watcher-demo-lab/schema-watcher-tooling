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

  it("ignores relation fields and parses models with nested braces in attributes", () => {
    const schema = `
      model User {
        id     String @id @default(cuid())
        posts  Post[]
        meta   Json   @default("{\\"theme\\": {\\"name\\": \\"dark\\"}}")
      }

      model Post {
        id      String @id @default(cuid())
        userId  String
        user    User   @relation(fields: [userId], references: [id])
      }
    `;

    const tables = parsePrisma(schema);
    const user = tables.find((table) => table.name === "User");
    const post = tables.find((table) => table.name === "Post");

    expect(user).toBeDefined();
    expect(post).toBeDefined();
    expect(Object.keys(user!.columns).sort()).toEqual(["id", "meta"]);
    expect(Object.keys(post!.columns).sort()).toEqual(["id", "userId"]);
  });
});
