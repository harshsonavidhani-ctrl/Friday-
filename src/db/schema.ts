import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export type Spec = { label: string; value: string };

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shopName: text("shop_name").notNull().default(""),
  phone: text("phone").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  gstin: text("gstin").notNull().default(""),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  role: text("role", { enum: ["admin", "retailer"] })
    .notNull()
    .default("retailer"),
  status: text("status", { enum: ["pending", "approved", "blocked"] })
    .notNull()
    .default("pending"),
  /** "en" | "hi" — language for alerts sent to this person */
  lang: text("lang").notNull().default("en"),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    // sha256 of the cookie token, never the token itself
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Logged in with a one-tap link from Mama → may set a new password without the old one. */
    viaLink: boolean("via_link").notNull().default(false),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** One-tap login links Mama sends on WhatsApp (sha256 of the token is stored). */
export const loginTokens = pgTable(
  "login_tokens",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("login_tokens_user_idx").on(t.userId)],
);

/** In-app alerts (bell icon) — also sent as phone notifications when turned on. */
export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("info"),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    url: text("url").notNull().default(""),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

/** Simple counters to slow down password guessing and spam. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("package"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    brand: text("brand").notNull().default(""),
    categoryId: integer("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    description: text("description").notNull().default(""),
    specs: jsonb("specs").$type<Spec[]>().notNull().default([]),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    moq: integer("moq").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("products_category_idx").on(t.categoryId)],
);

/** Each product has one or more variants (e.g. 12GB/256GB) with own price & stock. */
export const variants = pgTable(
  "variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    label: text("label").notNull().default(""),
    /** "fresh" (sealed box) or "activated" — Mama sells both, at different rates */
    kind: text("kind", { enum: ["fresh", "activated"] }).notNull().default("fresh"),
    modelNumber: text("model_number").notNull().default(""),
    price: integer("price").notNull().default(0),
    mrp: integer("mrp"),
    stock: integer("stock").notNull().default(0),
    prevPrice: integer("prev_price"),
    priceUpdatedAt: timestamp("price_updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("variants_product_idx").on(t.productId)],
);

export const cartItems = pgTable(
  "cart_items",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    variantId: integer("variant_id")
      .notNull()
      .references(() => variants.id, { onDelete: "cascade" }),
    qty: integer("qty").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.variantId] })],
);

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "dispatched",
  "ready",
  "completed",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** How the retailer plans to pay (chosen at checkout). */
export const PAY_PLANS = ["upi", "bank", "cash", "credit"] as const;
export type PayPlan = (typeof PAY_PLANS)[number];

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    status: text("status", { enum: ORDER_STATUSES })
      .notNull()
      .default("pending"),
    deliveryMethod: text("delivery_method", { enum: ["pickup", "parcel"] })
      .notNull()
      .default("pickup"),
    address: text("address").notNull().default(""),
    notes: text("notes").notNull().default(""),
    payPlan: text("pay_plan", { enum: PAY_PLANS }).notNull().default("upi"),
    subtotal: integer("subtotal").notNull().default(0),
    parcelCharge: integer("parcel_charge").notNull().default(0),
    discount: integer("discount").notNull().default(0),
    total: integer("total").notNull().default(0),
    transportInfo: text("transport_info").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("orders_user_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: integer("variant_id").references(() => variants.id, {
      onDelete: "set null",
    }),
    productId: integer("product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    // snapshots, so old orders still read correctly after edits/deletes
    name: text("name").notNull(),
    variantLabel: text("variant_label").notNull().default(""),
    image: text("image"),
    price: integer("price").notNull(),
    qty: integer("qty").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

/** IMEI / serial numbers of the exact pieces given on an order. */
export const orderSerials = pgTable(
  "order_serials",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderItemId: integer("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    serial: text("serial").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("order_serials_order_idx").on(t.orderId), index("order_serials_serial_idx").on(t.serial)],
);

export const PAYMENT_METHODS = ["upi", "bank", "cash", "cheque", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    method: text("method", { enum: PAYMENT_METHODS }).notNull().default("upi"),
    reference: text("reference").notNull().default(""),
    status: text("status", { enum: ["submitted", "verified", "rejected"] })
      .notNull()
      .default("submitted"),
    byAdmin: boolean("by_admin").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("payments_order_idx").on(t.orderId)],
);

/** Rate messages Mama pasted / made (WhatsApp text), kept until he deletes them. */
export const rateMessages = pgTable(
  "rate_messages",
  {
    id: serial("id").primaryKey(),
    kind: text("kind", { enum: ["old", "new"] }).notNull(),
    text: text("text").notNull(),
    /** the one "Old message" the next update starts from */
    isCurrent: boolean("is_current").notNull().default(false),
    changes: integer("changes").notNull().default(0),
    applied: boolean("applied").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("rate_messages_created_idx").on(t.createdAt)],
);

/** "This line in Mama's message = this model" — remembered until deleted. */
export const rateAliases = pgTable("rate_aliases", {
  key: text("key").primaryKey(),
  variantId: integer("variant_id")
    .notNull()
    .references(() => variants.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
