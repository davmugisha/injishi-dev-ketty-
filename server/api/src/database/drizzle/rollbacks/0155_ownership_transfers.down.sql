-- Rollback for migration 0155_ownership_transfers. NOT run by the migrator (it lives outside migrations/ on purpose).
--
-- Removes what 0155 added and nothing else: the ownership_transfers table and its status enum. Who owns each business is
-- NOT changed back: an accepted transfer already rewrote org_memberships, which is the record of ownership, and the
-- audit_events rows of every request stay. Only the request history is lost, so dump it first:
--   psql <database> -c "\copy (select * from ownership_transfers) to 'ownership-transfers-before-rollback.csv' csv header"
-- Roll back the API to a build that does not read this table BEFORE running this, or Team → Transfer ownership fails.
-- Safe to run twice. Read the count the first SELECT prints before you COMMIT.
BEGIN;
SELECT count(*) AS transfer_requests_that_will_be_lost FROM ownership_transfers;
DROP TABLE IF EXISTS public.ownership_transfers;
DROP TYPE IF EXISTS public.ownership_transfer_status;
COMMIT;
