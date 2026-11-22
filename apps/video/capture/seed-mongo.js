// Demo data for the showcase recording. Run with mongosh against the `showcase` database.
const STATUSES = [
  ["delivered", 2904],
  ["shipped", 1126],
  ["processing", 538],
  ["cancelled", 244],
];
const WEEK_START = new Date("2026-11-16T00:00:00Z").getTime();
const WEEK_MS = 4.5 * 24 * 60 * 60 * 1000;

let state = 42;
const random = () => {
  state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
  return state / 2_147_483_648;
};

const docs = STATUSES.flatMap(([status, count]) =>
  Array.from({ length: count }, () => ({
    customerId: Math.floor(random() * 900) + 1,
    items: Math.floor(random() * 4) + 1,
    placedAt: new Date(WEEK_START + random() * WEEK_MS),
    status,
    totalCents: Math.floor(1500 + random() * 18_000),
  }))
);

db.orders.drop();
db.orders.insertMany(docs);
db.orders.createIndex({ placedAt: 1 });
print(`orders: ${db.orders.countDocuments()}`);
