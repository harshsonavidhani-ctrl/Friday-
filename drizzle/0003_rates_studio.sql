CREATE TABLE "rate_aliases" (
	"key" text PRIMARY KEY NOT NULL,
	"variant_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"changes" integer DEFAULT 0 NOT NULL,
	"applied" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variants" ADD COLUMN "kind" text DEFAULT 'fresh' NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_aliases" ADD CONSTRAINT "rate_aliases_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rate_messages_created_idx" ON "rate_messages" USING btree ("created_at");