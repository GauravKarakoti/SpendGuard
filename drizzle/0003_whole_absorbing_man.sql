CREATE TABLE "audit_logs" (
	"id" varchar(128) PRIMARY KEY NOT NULL,
	"owner_address" varchar(255) NOT NULL,
	"agent_name" varchar(255) NOT NULL,
	"provider" varchar(255),
	"request_id" varchar(255),
	"task_type" varchar(255) NOT NULL,
	"status" varchar(50) NOT NULL,
	"price_paid" varchar(50),
	"tx_hash" varchar(255),
	"content_hash" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
