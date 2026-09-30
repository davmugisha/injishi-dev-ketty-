/**
 * The retention sweep's SQL (ADR-061 D-d, slice H), as plain text and values.
 *
 * No imports and nothing but erasable types, on purpose: the API runs these
 * through its pool, and the slice H oracle runs the SAME text against a fresh
 * Postgres (PGlite) with every migration replayed. A second, hand copied
 * version of the SQL for the test would prove only that the copy works.
 */

export interface RetentionQuery {
  text: string;
  values: unknown[];
}

/** How long an approval may sit in `approved` before the sweep closes it. */
export const STALE_APPROVAL_MS = 10 * 60_000;

/** At most this many conversations are deleted per statement. */
export const RETENTION_BATCH = 500;

/**
 * A proposal nobody decided on, past its 15 minutes, becomes `expired`. The
 * approve route already refuses it; this makes the stored state say so.
 */
export function expireStaleProposals(now: Date): RetentionQuery {
  return {
    text: `UPDATE assistant_action_proposals
             SET state = 'expired', decided_at = $1
           WHERE state = 'proposed' AND expires_at < $1`,
    values: [now],
  };
}

/**
 * Approvals interrupted between the claim and the finish (the process died),
 * with the live price read beside each, so the sweep can say what happened
 * rather than guess. The room type is matched within the proposal's own
 * workspace, as the executor reads it.
 */
export function staleApprovals(now: Date): RetentionQuery {
  return {
    text: `SELECT p.id, p.user_id, p.property_id, p.target_id, p.current_value, p.proposed_value,
                  p.request_text, rt.base_price_rwf AS live_price
             FROM assistant_action_proposals p
        LEFT JOIN room_types rt ON rt.id = p.target_id AND rt.workspace_id = p.workspace_id
            WHERE p.state = 'approved' AND p.decided_at < $1
         ORDER BY p.decided_at
            LIMIT ${RETENTION_BATCH}`,
    values: [new Date(now.getTime() - STALE_APPROVAL_MS)],
  };
}

/**
 * Close one interrupted approval and write its audit row, in ONE statement,
 * and only while it is still `approved`: a rerun, or a finish that landed
 * after the read, closes nothing twice and audits nothing twice.
 */
export function closeStaleApproval(input: {
  id: string;
  state: 'executed' | 'failed';
  error: string | null;
  detail: string;
}): RetentionQuery {
  return {
    text: `WITH closed AS (
             UPDATE assistant_action_proposals
                SET state = $2, error = $3
              WHERE id = $1 AND state = 'approved'
          RETURNING id, user_id, property_id, target_id, current_value, proposed_value, request_text
           )
           INSERT INTO audit_events (actor_user_id, subject_type, subject_id, event_type, payload_diff, reason)
           SELECT user_id, 'property', property_id,
                  CASE WHEN $2 = 'executed' THEN 'assistant.action.executed' ELSE 'assistant.action.failed' END,
                  jsonb_build_object(
                    'roomType:' || target_id || '.basePriceRwf',
                    jsonb_build_object('from', current_value, 'to', proposed_value),
                    'proposalId', id,
                    'detail', $4::text
                  ),
                  left('Support assistant proposal, approved by the person: ' || request_text, 2000)
             FROM closed
        RETURNING id`,
    values: [input.id, input.state, input.error, input.detail],
  };
}

/**
 * Delete expired conversations, and the proposals their answers prepared, in
 * one statement. Messages and feedback go by their cascade; a support ticket
 * keeps its context and loses only the link (`ON DELETE SET NULL`); an audit
 * row for an executed change is a separate record and follows audit retention.
 * Proposals are found through the messages' `tool_calls`, which is the only
 * place a proposal is tied to a conversation.
 */
export function deleteExpiredConversations(now: Date): RetentionQuery {
  return {
    text: `WITH doomed AS (
             SELECT id FROM assistant_conversations
              WHERE expires_at < $1
           ORDER BY expires_at
              LIMIT ${RETENTION_BATCH}
                FOR UPDATE SKIP LOCKED
           ),
           prepared AS (
             DELETE FROM assistant_action_proposals p
              WHERE p.id::text IN (
                SELECT jsonb_array_elements_text(tc -> 'proposalIds')
                  FROM assistant_messages m
            CROSS JOIN LATERAL jsonb_array_elements(m.tool_calls) tc
                 WHERE m.conversation_id IN (SELECT id FROM doomed)
                   AND jsonb_typeof(tc -> 'proposalIds') = 'array'
              )
          RETURNING p.id
           ),
           gone AS (
             DELETE FROM assistant_conversations c
              WHERE c.id IN (SELECT id FROM doomed)
          RETURNING c.id
           )
           SELECT (SELECT count(*) FROM gone)::int AS conversations,
                  (SELECT count(*) FROM prepared)::int AS proposals`,
    values: [now],
  };
}

/** A terminal proposal referenced by no message is deleted after this long. */
export const ORPHAN_PROPOSAL_MS = 24 * 60 * 60_000;

/**
 * A proposal no stored message refers to. It happens when a turn fails after
 * the model prepared a change: the answer is never stored, so the deletion
 * above can never reach the proposal through a conversation. Once it is
 * closed and a day old, nothing can show or approve it, so it goes. A proposal
 * still `proposed` or `approved` is left for the steps above to close first.
 */
export function deleteOrphanProposals(now: Date): RetentionQuery {
  return {
    text: `DELETE FROM assistant_action_proposals p
            WHERE p.state IN ('expired', 'rejected', 'failed', 'executed')
              AND p.created_at < $1
              AND NOT EXISTS (
                SELECT 1 FROM assistant_messages m
            CROSS JOIN LATERAL jsonb_array_elements(m.tool_calls) tc
                 WHERE jsonb_typeof(tc -> 'proposalIds') = 'array'
                   AND tc -> 'proposalIds' ? p.id::text
              )`,
    values: [new Date(now.getTime() - ORPHAN_PROPOSAL_MS)],
  };
}

/** One row of `staleApprovals`, as the driver returns it. */
export interface StaleApprovalRow {
  id: string;
  proposed_value: unknown;
  live_price: string | number | null;
}

export interface StaleApprovalOutcome {
  state: 'executed' | 'failed';
  /** Shown on the card. */
  error: string | null;
  /** Kept on the audit row. */
  detail: string;
}

/**
 * What an interrupted approval turned out to be, read from the live price and
 * never guessed. The executor sets exactly the approved value, so a live price
 * equal to it means the change ran and only its record was lost; anything else
 * means it did not run, and the card says to check rather than claiming a
 * change that cannot be seen.
 */
export function staleApprovalOutcome(row: StaleApprovalRow): StaleApprovalOutcome {
  const live = row.live_price === null ? null : Number(row.live_price);
  if (live !== null && live === Number(row.proposed_value)) {
    return {
      state: 'executed',
      error: null,
      detail: 'The approval was interrupted before it was recorded; the live price already equals the approved value, so it is recorded as made.',
    };
  }
  return {
    state: 'failed',
    error: 'This change was interrupted and not confirmed. Check the Inventory screen, and ask again if the price is not what you wanted.',
    detail: 'The approval was interrupted before it was recorded; the live price does not equal the approved value, so nothing is recorded as made.',
  };
}
