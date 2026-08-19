ALTER TABLE "event" RENAME COLUMN "parce_excel_id" TO "parse_excel_id";--> statement-breakpoint
ALTER TABLE "event" DROP CONSTRAINT "event_parce_excel_id_parse_excel_id_fk";
--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_parse_excel_id_parse_excel_id_fk" FOREIGN KEY ("parse_excel_id") REFERENCES "public"."parse_excel"("id") ON DELETE no action ON UPDATE no action;