-- ADR-075 A1 task 4: the documents a registration asks for, by kind (S5, AC-11). One new kind, the franchisee's
-- agreement (O-7), optional and asked only of a franchisee. Which kinds are required is code, not schema: the
-- one table is `registrationDocumentRows` in @injishi/contracts, read by the wizard and by create alike.
--
-- Written by hand, as 0074 and 0075 were: generating would also drop the waitlist drift 0074 describes.
ALTER TYPE "public"."org_certificate_kind" ADD VALUE 'franchise_agreement';
