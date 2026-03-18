import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  PushNotificationPayload,
  SendPushResult,
} from '../types';

let vapidConfigured = false;

function ensureVapidConfigured(): void {
  if (vapidConfigured) return;

  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!subject || !publicKey || !privateKey) {
    throw new Error(
      'Missing VAPID configuration. Run: node scripts/generate-vapid-keys.js'
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
}

/**
 * Subscribes a push endpoint for a gym owner.
 * Upserts — if the endpoint already exists, it updates the keys.
 */
export async function subscribePush(
  gymId: string,
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent: string | null
): Promise<void> {
  const supabase = createAdminClient();

  // Delete any existing subscription with same endpoint, then insert fresh
  await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', subscription.endpoint);

  const { error } = await supabase.from('push_subscriptions').insert({
    gym_id: gymId,
    user_id: userId,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    user_agent: userAgent,
  });

  if (error) {
    throw new Error(`Failed to save push subscription: ${error.message}`);
  }
}

/**
 * Removes a push subscription by endpoint.
 */
export async function unsubscribePush(endpoint: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) {
    throw new Error(`Failed to remove push subscription: ${error.message}`);
  }
}

/**
 * Sends a push notification to all subscribed devices for a gym.
 */
export async function sendPushToGym(
  gymId: string,
  payload: PushNotificationPayload
): Promise<SendPushResult> {
  ensureVapidConfigured();

  const supabase = createAdminClient();

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('gym_id', gymId);

  if (error) {
    throw new Error(`Failed to fetch push subscriptions: ${error.message}`);
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { total: 0, successful: 0, failed: 0, staleEndpoints: [] };
  }

  const notificationPayload = JSON.stringify(payload);
  const staleEndpoints: string[] = [];
  let successful = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      await webpush.sendNotification(pushSubscription, notificationPayload);
    })
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      successful++;
    } else {
      failed++;
      // 410 Gone means the subscription is no longer valid
      const statusCode = (result.reason as { statusCode?: number })?.statusCode;
      if (statusCode === 410 || statusCode === 404) {
        staleEndpoints.push(subscriptions[i].endpoint);
      }
      console.error(
        `Push notification failed for endpoint: ${subscriptions[i].endpoint}`,
        result.reason
      );
    }
  }

  // Clean up stale subscriptions
  if (staleEndpoints.length > 0) {
    await cleanupStaleSubscriptions(staleEndpoints);
  }

  return {
    total: subscriptions.length,
    successful,
    failed,
    staleEndpoints,
  };
}

/**
 * Removes subscriptions that returned 410 Gone or 404.
 */
async function cleanupStaleSubscriptions(
  endpoints: string[]
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .in('endpoint', endpoints);

  if (error) {
    console.error('Failed to cleanup stale push subscriptions:', error.message);
  } else {
    console.log(`Cleaned up ${endpoints.length} stale push subscription(s)`);
  }
}
