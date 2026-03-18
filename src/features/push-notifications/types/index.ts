export interface PushSubscriptionRecord {
  id: string;
  gym_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    type?: 'announcement' | 'reminder' | 'system';
    announcementId?: string;
  };
}

export interface SendPushResult {
  total: number;
  successful: number;
  failed: number;
  staleEndpoints: string[];
}
