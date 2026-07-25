import type { Member } from '../domain/Member'

/**
 * Serializes a Member domain entity to API response format
 *
 * Converts Date objects to YYYY-MM-DD strings to ensure proper JSON serialization.
 * This prevents NextResponse.json() from converting dates to ISO timestamps.
 *
 * @param member - Member domain entity
 * @param discount - Optional discount information from repository join
 */
export function serializeMemberForAPI(
  member: Member,
  discount?: {
    id: string
    discount_name: string
    discount_percentage: number
  } | null
) {
  const props = member.toDatabase()

  return {
    id: props.id,
    gymId: props.gymId,
    memberNumber: props.memberNumber ?? null,
    member_number: props.memberNumber ?? null, // Include snake_case for backward compatibility
    name: props.name,
    phoneNumber: props.phoneNumber,
    phone_number: props.phoneNumber, // Include snake_case for backward compatibility
    planType: props.planType,
    plan_type: props.planType, // Include snake_case for backward compatibility
    planAmount: props.planAmount,
    plan_amount: props.planAmount, // Include snake_case for backward compatibility
    discountId: props.discountId,
    discount_id: props.discountId, // Include snake_case for backward compatibility
    recurringDiscount: props.recurringDiscount,
    recurring_discount: props.recurringDiscount, // Include snake_case for backward compatibility
    status: props.status,
    registeredDate: props.registeredDate.toISOString().split('T')[0],
    registered_date: props.registeredDate.toISOString().split('T')[0], // Include snake_case for backward compatibility
    membershipStartDate: props.membershipStartDate.toISOString().split('T')[0],
    membership_start_date: props.membershipStartDate
      .toISOString()
      .split('T')[0], // Include snake_case for backward compatibility
    nextDueDate: props.nextDueDate.toISOString().split('T')[0],
    next_due_date: props.nextDueDate.toISOString().split('T')[0], // Include snake_case for backward compatibility
    createdAt: props.createdAt.toISOString(),
    created_at: props.createdAt.toISOString(), // Include snake_case for backward compatibility
    updatedAt: props.updatedAt.toISOString(),
    updated_at: props.updatedAt.toISOString(), // Include snake_case for backward compatibility
    photoPath: member.photoPath,
    photo_path: member.photoPath, // Include snake_case for backward compatibility
    photoUpdatedAt: member.photoUpdatedAt?.toISOString() ?? null,
    photo_updated_at: member.photoUpdatedAt?.toISOString() ?? null, // Include snake_case for backward compatibility
    registrationSource: member.registrationSource,
    registration_source: member.registrationSource, // Include snake_case for backward compatibility
    verifiedAt: member.verifiedAt?.toISOString() ?? null,
    verified_at: member.verifiedAt?.toISOString() ?? null, // Include snake_case for backward compatibility
    remarks: member.remarks,
    acceptedTermsAt: member.acceptedTermsAt?.toISOString() ?? null,
    accepted_terms_at: member.acceptedTermsAt?.toISOString() ?? null, // Include snake_case for backward compatibility
    acceptedGymRulesAt: member.acceptedGymRulesAt?.toISOString() ?? null,
    accepted_gym_rules_at: member.acceptedGymRulesAt?.toISOString() ?? null, // Include snake_case for backward compatibility
    discount: discount || null, // Include joined discount data if available
  }
}
