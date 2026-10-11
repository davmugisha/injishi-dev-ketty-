-- ADR-050 D-q: threads_booking_department_request_uk, one conversation per
-- (booking_id, department_id), for a desk thread opened BEFORE arrival.
--
-- The partial unique this repository already had covers a guest who is IN
-- HOUSE, keyed on their stay. A guest who has booked and not yet arrived has
-- no stay at all, so their desk conversation hangs off the booking and that
-- index cannot see it: two taps on "Message Housekeeping" from the trip
-- screen would open two threads, split the history, and leave half of it
-- where the desk had stopped looking.
--
-- Each clause of the predicate earns its place.
-- thread_kind = 'department_request', so a dispute raised about the same
-- booking stays a conversation of its own. guest_stay_id is null so this index and the
-- stay-scoped one can never both govern a row. status = 'active' because an
-- archived conversation is closed rather than in the way -- the service reads
-- the existing row whatever its status and refuses to write into an archived
-- one, so the database is not the thing deciding that.
--
-- IF NOT EXISTS, and numbered 0051: this index first shipped as a hand written
-- 0049 on the guest post-booking chat branch, and the demo ran that commit
-- (722d1af), so a demo database can already hold it. It lands here generated
-- against 0050's snapshot, so the snapshot chain on main stays unbroken.
CREATE UNIQUE INDEX IF NOT EXISTS "threads_booking_department_request_uk" ON "threads" USING btree ("booking_id","department_id") WHERE "threads"."thread_kind" = 'department_request'
             AND "threads"."guest_stay_id" IS NULL
             AND "threads"."booking_id" IS NOT NULL
             AND "threads"."department_id" IS NOT NULL
             AND "threads"."status" = 'active';
