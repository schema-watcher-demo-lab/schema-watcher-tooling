import { describe, expect, it } from "vitest";
import { ParserRegistry } from "../src/parser";

describe("parsePython", () => {
  it("parses SQLAlchemy model columns from models.py", () => {
    const model = `
      class User(Base):
        __tablename__ = "users"

        id = Column(Integer, primary_key=True)
        email = Column(String, nullable=False)
        active = Column(Boolean)
    `;

    const parser = new ParserRegistry();
    const tables = parser.parse(model, "app/models.py");

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("users");
    expect(tables[0].columns.id.type).toBe("Integer");
    expect(tables[0].columns.email.nullable).toBe(false);
  });

  it("parses Alembic op.create_table columns", () => {
    const migration = `
      def upgrade():
          op.create_table(
            "users",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("email", sa.String(), nullable=False),
          )
    `;

    const parser = new ParserRegistry();
    const tables = parser.parse(migration, "alembic/versions/0001_baseline.py");

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("users");
    expect(tables[0].columns.email.type).toBe("String");
  });
});
