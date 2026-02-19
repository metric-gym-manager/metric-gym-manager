// ============================================================
// SMS TYPES
// ============================================================

export type SMSType =
  | 'welcome'
  | 'reminder_7day'
  | 'reminder_3day'
  | 'due_today'
  | 'overdue'
  | 'receipt';

export type DeliveryStatus = 'sent' | 'delivered' | 'failed';

export interface SMSLog {
  id: string;
  member_id: string;
  gym_id: string;
  sms_type: SMSType;
  phone_number: string;
  message_body: string;
  sent_at: string;
  delivery_status: DeliveryStatus;
  text_lk_message_id: string | null;
  created_at: string;
}

export interface MemberReminderStatus {
  id: string;
  name: string;
  phone_number: string;
  plan_type: 'monthly' | 'daily' | 'annual';
  next_due_date: string;
  days_until_due: number; // Negative for overdue
  last_reminder_sent: string | null;
  last_reminder_type: SMSType | null;
  last_delivery_status: DeliveryStatus | null;
}

// ============================================================
// REQUEST/RESPONSE TYPES
// ============================================================

export interface SendSMSRequest {
  memberId: string;
  smsType: SMSType;
  customMessage?: string;
}

export interface SendSMSResponse {
  success: boolean;
  smsLog: SMSLog;
}

export interface ReminderStatusResponse {
  reminders: MemberReminderStatus[];
  totalCount: number;
}
