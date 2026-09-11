CREATE TABLE "http402_flows" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"label" varchar(255) NOT NULL,
	"method" varchar(10) NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"request_payload" jsonb NOT NULL,
	"response_402" jsonb,
	"response_200" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "providers" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"icon_type" varchar(50) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"quality" numeric(3, 2) NOT NULL,
	"latency" numeric(4, 1) NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"reason" varchar(500)
);
