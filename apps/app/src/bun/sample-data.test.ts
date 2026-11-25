import { describe, expect, it } from "vitest";

import { buildSampleData, SAMPLE_SCHEMA } from "./sample-data.ts";

const NOW = new Date("2026-11-24T15:30:00.000Z");

describe("buildSampleData", () => {
  const data = buildSampleData(NOW);

  it("builds the same data every time", () => {
    expect(buildSampleData(NOW)).toStrictEqual(data);
  });

  it("covers a year of orders and stops at now", () => {
    const stamps = data.orders.map((order) => order.createdAt);
    expect(stamps.at(0)?.startsWith("2025-11-24")).toBeTruthy();
    expect(
      stamps.every((stamp) => stamp <= "2026-11-24 15:30:00")
    ).toBeTruthy();
    expect(data.orders.length).toBeGreaterThan(2000);
  });

  it("keeps every reference inside the data", () => {
    const customerIds = new Set(data.customers.map((customer) => customer.id));
    const productIds = new Set(data.products.map((product) => product.id));
    const orderIds = new Set(data.orders.map((order) => order.id));

    expect(
      data.orders.every((order) => customerIds.has(order.customerId))
    ).toBeTruthy();
    expect(
      data.orderItems.every((item) => orderIds.has(item.orderId))
    ).toBeTruthy();
    expect(
      data.orderItems.every((item) => productIds.has(item.productId))
    ).toBeTruthy();
  });

  it("makes each order total the sum of its lines", () => {
    const totals = new Map(data.orders.map((order) => [order.id, 0]));
    for (const item of data.orderItems) {
      totals.set(
        item.orderId,
        Number(totals.get(item.orderId)) + item.quantity * item.unitPrice
      );
    }
    expect(data.orders.map((order) => totals.get(order.id))).toStrictEqual(
      data.orders.map((order) => order.total)
    );
  });

  it("gives every customer a distinct example.com address", () => {
    const emails = data.customers.map((customer) => customer.email);
    expect(new Set(emails).size).toBe(emails.length);
    expect(
      emails.every((email) => email.endsWith("@example.com"))
    ).toBeTruthy();
  });

  it("mostly sells paid orders, with a few of every other status", () => {
    const statuses = new Set(data.orders.map((order) => order.status));
    const paid = data.orders.filter((order) => order.status === "paid");

    expect(statuses).toStrictEqual(
      new Set(["paid", "pending", "refunded", "failed"])
    );
    expect(paid.length / data.orders.length).toBeGreaterThan(0.8);
  });
});

describe("sAMPLE_SCHEMA", () => {
  it("creates the four tables", () => {
    const tables = SAMPLE_SCHEMA.filter((statement) =>
      statement.startsWith("CREATE TABLE")
    );
    expect(tables).toHaveLength(4);
  });
});
