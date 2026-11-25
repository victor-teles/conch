export interface SampleCustomer {
  id: number;
  name: string;
  email: string;
  country: string;
  plan: string;
  createdAt: string;
}

export interface SampleProduct {
  id: number;
  name: string;
  category: string;
  price: number;
}

export interface SampleOrder {
  id: number;
  customerId: number;
  status: string;
  total: number;
  createdAt: string;
}

export interface SampleOrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  unitPrice: number;
}

export interface SampleData {
  customers: SampleCustomer[];
  products: SampleProduct[];
  orders: SampleOrder[];
  orderItems: SampleOrderItem[];
}

export const SAMPLE_SCHEMA: readonly string[] = [
  `CREATE TABLE customers (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    country TEXT NOT NULL,
    plan TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL
  )`,
  `CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES customers (id),
    status TEXT NOT NULL,
    total REAL NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE order_items (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders (id),
    product_id INTEGER NOT NULL REFERENCES products (id),
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL
  )`,
  "CREATE INDEX orders_created_at ON orders (created_at)",
  "CREATE INDEX orders_customer_id ON orders (customer_id)",
  "CREATE INDEX order_items_order_id ON order_items (order_id)",
];

const DAY_MS = 24 * 60 * 60 * 1000;
const DAYS_OF_HISTORY = 365;
const CUSTOMER_COUNT = 240;

const FIRST_NAMES = [
  "Ana",
  "Bruno",
  "Chloe",
  "Diego",
  "Elena",
  "Farid",
  "Grace",
  "Hugo",
  "Ines",
  "Jonas",
  "Keiko",
  "Liam",
  "Maya",
  "Noah",
  "Olga",
  "Pablo",
];
const LAST_NAMES = [
  "Almeida",
  "Becker",
  "Costa",
  "Dubois",
  "Evans",
  "Ferrari",
  "Garcia",
  "Haddad",
  "Ito",
  "Jensen",
  "Kowalski",
  "Lopez",
  "Moreau",
  "Nakamura",
  "Okafor",
];
const COUNTRIES = ["US", "US", "US", "BR", "BR", "DE", "FR", "GB", "JP", "CA"];
const PLANS = ["free", "free", "free", "pro", "pro", "team"];
const STATUSES = [
  ...Array.from({ length: 86 }, () => "paid"),
  ...Array.from({ length: 6 }, () => "pending"),
  ...Array.from({ length: 5 }, () => "refunded"),
  ...Array.from({ length: 3 }, () => "failed"),
];

const PRODUCTS: readonly Omit<SampleProduct, "id">[] = [
  { category: "Coffee", name: "House Blend 250g", price: 14 },
  { category: "Coffee", name: "Ethiopia Single Origin 250g", price: 19 },
  { category: "Coffee", name: "Decaf Colombia 250g", price: 16 },
  { category: "Coffee", name: "Espresso Roast 1kg", price: 42 },
  { category: "Tea", name: "Sencha Green 100g", price: 12 },
  { category: "Tea", name: "Earl Grey 100g", price: 11 },
  { category: "Tea", name: "Chamomile 80g", price: 9 },
  { category: "Gear", name: "Pour-over Dripper", price: 28 },
  { category: "Gear", name: "Gooseneck Kettle", price: 64 },
  { category: "Gear", name: "Burr Grinder", price: 129 },
  { category: "Gear", name: "Paper Filters (100)", price: 8 },
  { category: "Gear", name: "Digital Scale", price: 35 },
  { category: "Cups", name: "Ceramic Mug", price: 18 },
  { category: "Cups", name: "Travel Tumbler", price: 26 },
  { category: "Cups", name: "Espresso Cup Set", price: 32 },
  { category: "Gift", name: "Tasting Box", price: 48 },
];

// Park–Miller: the same data every time, so screenshots and docs stay true.
const createRandom = (seed: number) => {
  let state = seed;
  const next = (): number => {
    state = (state * 48_271) % 2_147_483_647;
    return state / 2_147_483_647;
  };
  return {
    below: (limit: number): number => Math.floor(next() * limit),
    pick: <T>(items: readonly T[]): T => {
      const item = items[Math.floor(next() * items.length)];
      if (item === undefined) {
        throw new Error("cannot pick from an empty list");
      }
      return item;
    },
  };
};

type Random = ReturnType<typeof createRandom>;

const pad = (value: number): string => String(value).padStart(2, "0");

const timestamp = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;

const startOfDay = (now: Date, daysAgo: number): number =>
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
  daysAgo * DAY_MS;

const round = (value: number): number => Math.round(value * 100) / 100;

const buildCustomers = (now: Date, random: Random): SampleCustomer[] =>
  Array.from({ length: CUSTOMER_COUNT }, (_, index) => {
    const first = random.pick(FIRST_NAMES);
    const last = random.pick(LAST_NAMES);
    const joined = startOfDay(now, random.below(DAYS_OF_HISTORY + 180));
    return {
      country: random.pick(COUNTRIES),
      createdAt: timestamp(new Date(joined + random.below(DAY_MS))),
      email: `${first}.${last}.${index + 1}@example.com`.toLowerCase(),
      id: index + 1,
      name: `${first} ${last}`,
      plan: random.pick(PLANS),
    };
  });

// Orders grow through the year and dip at weekends, so charts have a shape.
const ordersOn = (daysAgo: number, weekday: number, random: Random): number => {
  const growth = ((DAYS_OF_HISTORY - daysAgo) / DAYS_OF_HISTORY) * 5;
  const weekend = weekday === 0 || weekday === 6 ? -2 : 0;
  return Math.max(1, Math.round(4 + growth + weekend) + random.below(4));
};

export const buildSampleData = (now: Date): SampleData => {
  const random = createRandom(20_261_124);
  const products = PRODUCTS.map((product, index) => ({
    ...product,
    id: index + 1,
  }));
  const customers = buildCustomers(now, random);
  const orders: SampleOrder[] = [];
  const orderItems: SampleOrderItem[] = [];

  for (let daysAgo = DAYS_OF_HISTORY; daysAgo >= 0; daysAgo -= 1) {
    const dayStart = startOfDay(now, daysAgo);
    const count = ordersOn(daysAgo, new Date(dayStart).getUTCDay(), random);
    for (let index = 0; index < count; index += 1) {
      const createdAt = new Date(dayStart + random.below(DAY_MS));
      if (createdAt.getTime() > now.getTime()) {
        continue;
      }
      const orderId = orders.length + 1;
      let total = 0;
      for (let line = random.below(3); line >= 0; line -= 1) {
        const product = random.pick(products);
        const quantity = 1 + random.below(3);
        total += product.price * quantity;
        orderItems.push({
          id: orderItems.length + 1,
          orderId,
          productId: product.id,
          quantity,
          unitPrice: product.price,
        });
      }
      orders.push({
        createdAt: timestamp(createdAt),
        customerId: random.pick(customers).id,
        id: orderId,
        status: random.pick(STATUSES),
        total: round(total),
      });
    }
  }

  return { customers, orderItems, orders, products };
};
