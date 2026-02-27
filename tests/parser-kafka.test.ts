import { describe, expect, it } from "vitest";
import { ParserRegistry } from "../src/parser";

describe("parseKafkaSchemas", () => {
  it("parses Avro schema fields", () => {
    const avro = `{
      "type": "record",
      "name": "OrderCreated",
      "fields": [
        {"name": "order_id", "type": "string"},
        {"name": "customer_id", "type": "string"}
      ]
    }`;

    const parser = new ParserRegistry();
    const tables = parser.parse(avro, "schemas/order_created.avsc");

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("OrderCreated");
    expect(tables[0].columns.order_id.type).toBe("string");
  });

  it("parses Protobuf message fields", () => {
    const proto = `
      syntax = "proto3";
      message OrderCreated {
        string order_id = 1;
        string customer_id = 2;
      }
    `;

    const parser = new ParserRegistry();
    const tables = parser.parse(proto, "schemas/order_created.proto");

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("OrderCreated");
    expect(tables[0].columns.order_id.type).toBe("string");
  });

  it("parses JSON schema properties", () => {
    const jsonSchema = `{
      "title": "OrderCreated",
      "type": "object",
      "properties": {
        "order_id": {"type": "string"},
        "customer_id": {"type": "string"}
      }
    }`;

    const parser = new ParserRegistry();
    const tables = parser.parse(jsonSchema, "schemas/order_created.schema.json");

    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe("OrderCreated");
    expect(tables[0].columns.customer_id.type).toBe("string");
  });
});
