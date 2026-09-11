CREATE TABLE "agents" (
	"agent_name" varchar(255) PRIMARY KEY NOT NULL,
	"agent_address" varchar(255) NOT NULL,
	"private_key" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
