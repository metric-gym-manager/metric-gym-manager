-- Create push_subscriptions table for Web Push notification subscriptions
-- Stores browser push subscriptions for gym owners to receive push notifications

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant scoping
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,

  -- Ties to the gym owner's Supabase auth account
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Web Push subscription data (from PushSubscription.toJSON())
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,

  -- Metadata
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  -- Prevent duplicate subscriptions for same endpoint
  CONSTRAINT unique_push_endpoint UNIQUE (endpoint)
);

-- Indexes for efficient lookups
CREATE INDEX idx_push_subscriptions_gym_id ON push_subscriptions(gym_id);
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Trigger for updated_at (reuses existing function from gyms migration)
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: gym owners manage their own subscriptions
CREATE POLICY "Users can view own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE push_subscriptions IS 'Stores Web Push API subscriptions for gym owners to receive push notifications';
