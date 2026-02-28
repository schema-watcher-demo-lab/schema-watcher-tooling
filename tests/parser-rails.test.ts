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

  it("parses add_column migrations", () => {
    const migration = `
      class AddBillingToUsers < ActiveRecord::Migration[7.1]
        def change
          add_column :users, :billing_email, :string, null: false
          add_column :users, :credits, :integer
        end
      end
    `;

    const parser = new ParserRegistry();
    const tables = parser.parse(migration, "db/migrate/20260227000200_add_billing_to_users.rb");

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("users");
    expect(tables[0].columns.billing_email.nullable).toBe(false);
    expect(tables[0].columns.credits.type).toBe("integer");
  });
});
