import { pgTable, varchar, numeric, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";

export const providers = pgTable("providers", {
  id: varchar("id", { length: 255 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  iconType: varchar("icon_type", { length: 50 }).notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  quality: numeric("quality", { precision: 3, scale: 2 }).notNull(),
  latency: numeric("latency", { precision: 4, scale: 1 }).notNull(),
  selected: boolean("selected").default(false).notNull(),
  reason: varchar("reason", { length: 500 }),
});

export const http402Flows = pgTable("http402_flows", {
  id: varchar("id", { length: 255 }).primaryKey(),
  label: varchar("label", { length: 255 }).notNull(),
  method: varchar("method", { length: 10 }).notNull(),
  endpoint: varchar("endpoint", { length: 255 }).notNull(),
  requestPayload: jsonb("request_payload").notNull(),
  response402: jsonb("response_402"),
  response200: jsonb("response_200"),
  ownerAddress: varchar("owner_address", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agents = pgTable("agents", {
  agentName: varchar("agent_name", { length: 255 }).primaryKey(),
  agentAddress: varchar("agent_address", { length: 255 }).notNull(),
  ownerAddress: varchar("owner_address", { length: 255 }).notNull(),
  privateKey: varchar("private_key", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id", { length: 128 }).primaryKey(), // Unique ID for the log
  ownerAddress: varchar("owner_address", { length: 255 }).notNull(),
  agentName: varchar("agent_name", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 255 }),
  requestId: varchar("request_id", { length: 255 }),
  taskType: varchar("task_type", { length: 255 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(), // e.g., '402_PAYWALL', 'COMPLETED', 'FAILED'
  pricePaid: varchar("price_paid", { length: 50 }),
  txHash: varchar("tx_hash", { length: 255 }),
  contentHash: varchar("content_hash", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});