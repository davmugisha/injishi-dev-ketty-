-- Moving out (WP 1.7): the landlord is nudged once about a notice still to acknowledge after 3 days.
ALTER TABLE "move_out_notices" ADD COLUMN "nudged_at" timestamp with time zone;
