CREATE TABLE "app"."development_probe" (
	"id" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL
);
