-- Index sms_logs.text_lk_message_id -- the column the text.lk delivery webhook
-- looks a row up by.
--
-- The table had seven indexes and none on this column, so every delivery receipt
-- was a sequential scan over the whole log. That cost nothing to date only because
-- the webhook has never successfully updated a row (it wrote to a non-existent
-- `updated_at` column and used a session client against a table with no UPDATE
-- policy). Once the webhook works, the receipt volume equals the send volume.
--
-- Partial: rows are only looked up by this column when it is non-null, and a
-- failed send never receives a vendor id -- 14 of the 1,151 rows at time of
-- writing. Keeping nulls out of the index keeps it proportional to the messages
-- that can actually receive a receipt.
--
-- Deliberately NOT unique. The vendor's id space is not ours to guarantee, and a
-- UNIQUE index would turn a vendor-side id collision into a failed INSERT on a
-- send -- losing the log of a message that was actually delivered. The webhook
-- handles the ambiguity instead, by scoping its update and reporting how many
-- rows it matched.

CREATE INDEX IF NOT EXISTS idx_sms_logs_text_lk_message_id
  ON public.sms_logs (text_lk_message_id)
  WHERE text_lk_message_id IS NOT NULL;
