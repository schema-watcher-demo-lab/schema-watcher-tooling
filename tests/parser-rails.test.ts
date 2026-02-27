import { describe, expect, it } from "vitest";
import { ParserRegistry } from "../src/parser";

describe("parseRails", () => {
  it("parses create_table migration columns", () => {
    const migration = `
      class CreateUsers < ActiveRecord::Migration[7.1]
        def change
          create_table :users do |t|
            t.string :email, null: false
            t.integer :age
            t.timestamps
          end
        end
      end
    `;

    const parser = new ParserRegistry();
    const tables = parser.parse(migration, "db/migrate/20260227000100_create_users.rb");

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("users");
    expect(tables[0].columns.email.type).toBe("string");
    expect(tables[0].columns.age.type).toBe("integer");
  });
});
