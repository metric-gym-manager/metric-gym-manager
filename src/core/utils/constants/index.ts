// Constants exports - Single Source of Truth
export {
  PlanType,
  PLAN_CONFIGS,
  getPlanConfig,
  getAllPlanTypes,
  getPlanLabel,
  isValidPlanType,
  fromDatabasePlanType,
  type PlanConfiguration,
  type DurationMethod,
} from '@/features/members/config/PlanConfig';

export {
  ReminderType,
  REMINDER_RULES,
  getReminderRule,
  shouldSendReminder,
  getReminderType,
  getEnabledReminders,
  getReminderDays,
  hasReminders,
  getReminderTypeLabel,
  type ReminderRule,
} from '@/features/sms/config/ReminderConfig';

export {
  MemberStatus,
  VALID_TRANSITIONS,
  canTransition,
  getValidTransitions,
  getTransitionConfig,
  requiresReason,
  isTerminalStatus,
  getStatusLabel,
  getStatusColor,
  isValidMemberStatus,
  type StatusTransition,
} from '@/features/members/config/StatusConfig';
