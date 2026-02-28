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

  it("parses mysqlTable schemas outside drizzle/ path", () => {
    const schema = `
      import { mysqlTable, varchar } from "drizzle-orm/mysql-core";
      export const customers = mysqlTable("customers", {
        id: varchar("id", { length: 64 }).notNull(),
      });
    `;

    const parser = new ParserRegistry();
    const tables = parser.parse(schema, "db/schema.ts");

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("customers");
    expect(tables[0].columns.id.nullable).toBe(false);
  });

  it("marks columns as not nullable when notNull() is on next line", () => {
    const schema = `
      import { sqliteTable, text } from "drizzle-orm/sqlite-core";
      export const users = sqliteTable("users", {
        email: text("email")
          .notNull(),
      });
    `;

    const parser = new ParserRegistry();
    const tables = parser.parse(schema, "schema.ts");

    expect(tables).toHaveLength(1);
    expect(tables[0].columns.email.nullable).toBe(false);
  });
});
