import { describe, expect, it } from "vitest";
import { ParserRegistry } from "../src/parser";

describe("parseDrizzle", () => {
  it("parses pgTable columns from drizzle schema", () => {
    const schema = `
      import { pgTable, serial, varchar, integer } from "drizzle-orm/pg-core";

      export const users = pgTable("users", {
        id: serial("id").primaryKey(),
        email: varchar("email", { length: 255 }).notNull(),
        age: integer("age"),
      });
    `;

    const parser = new ParserRegistry();
    const tables = parser.parse(schema, "drizzle/schema.ts");

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("users");
    expect(tables[0].columns.email.type).toBe("varchar");
    expect(tables[0].columns.email.nullable).toBe(false);
    expect(tables[0].columns.age.type).toBe("integer");
  });
});
