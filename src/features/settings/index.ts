// ============================================================
// SETTINGS FEATURE EXPORTS
// ============================================================

// Export types
export type {
  GymSettings,
  PlanType,
  Discount,
  SecuritySettings,
} from './types';

// Export schemas
export {
  updateGymInfoSchema,
  updatePlanTypeSchema,
  createDiscountSchema,
  updateDiscountSchema,
  updatePasswordSchema,
  updateEmailSchema,
  PlanTypeEnum,
} from './schemas/settings.schemas';

export type {
  UpdateGymInfoInput,
  UpdatePlanTypeInput,
  CreateDiscountInput,
  UpdateDiscountInput,
  UpdatePasswordInput,
  UpdateEmailInput,
} from './schemas/settings.schemas';

// Export services
export {
  updateGymInfo,
  getPlanTypes,
  updatePlanType,
  getDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
} from './services/settings.service';
