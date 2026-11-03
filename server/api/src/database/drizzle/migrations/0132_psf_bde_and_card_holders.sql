-- PSF, 2026-11-02 (the owner's decisions):
--
--  - A District Manager appoints its district's BDEs (Business Development & Empowerment, the role
--    `psf_business_officer`); a Province Manager appoints District Managers. Each appointment records
--    the person's ID, typed by whoever appoints them.
--  - A business that holds an old PSF card, with no number or certificate in the new module, joins
--    through the form as a card holder: no fee now, a new membership number, and the year on its card.
ALTER TABLE "oversight_assignments" ADD COLUMN "id_document_type" text;--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD COLUMN "id_document_number" text;--> statement-breakpoint
ALTER TABLE "oversight_assignments" ADD CONSTRAINT "oversight_assignments_id_document_type" CHECK ("oversight_assignments"."id_document_type" IS NULL OR "oversight_assignments"."id_document_type" IN ('national_id', 'passport'));--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD COLUMN "intake" text DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "psf_membership_applications" ADD CONSTRAINT "psf_membership_applications_intake" CHECK ("psf_membership_applications"."intake" IN ('new', 'card_holder'));
