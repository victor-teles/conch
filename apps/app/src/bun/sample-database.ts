import { Database } from "bun:sqlite";
import { mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

import type { SampleData } from "./sample-data.ts";

import { SAMPLE_SCHEMA } from "./sample-data.ts";

const insertAll = (db: Database, data: SampleData): void => {
  const customer = db.prepare(
    "INSERT INTO customers (id, name, email, country, plan, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const product = db.prepare(
    "INSERT INTO products (id, name, category, price) VALUES (?, ?, ?, ?)"
  );
  const order = db.prepare(
    "INSERT INTO orders (id, customer_id, status, total, created_at) VALUES (?, ?, ?, ?, ?)"
  );
  const item = db.prepare(
    "INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?, ?)"
  );
  for (const row of data.customers) {
    customer.run(
      row.id,
      row.name,
      row.email,
      row.country,
      row.plan,
      row.createdAt
    );
  }
  for (const row of data.products) {
    product.run(row.id, row.name, row.category, row.price);
  }
  for (const row of data.orders) {
    order.run(row.id, row.customerId, row.status, row.total, row.createdAt);
  }
  for (const row of data.orderItems) {
    item.run(row.id, row.orderId, row.productId, row.quantity, row.unitPrice);
  }
};

// Written beside the target and renamed, so a crash never leaves half a file.
export const writeSampleDatabase = (
  filePath: string,
  data: SampleData
): void => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const draftPath = `${filePath}.tmp`;
  rmSync(draftPath, { force: true });
  const db = new Database(draftPath, { create: true, readwrite: true });
  try {
    for (const statement of SAMPLE_SCHEMA) {
      db.run(statement);
    }
    db.transaction(() => insertAll(db, data))();
  } finally {
    db.close();
  }
  renameSync(draftPath, filePath);
};
