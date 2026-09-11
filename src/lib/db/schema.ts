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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agents = pgTable("agents", {
  agentName: varchar("agent_name", { length: 255 }).primaryKey(),
  agentAddress: varchar("agent_address", { length: 255 }).notNull(),
  ownerAddress: varchar("owner_address", { length: 255 }).notNull(),
  privateKey: varchar("private_key", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});