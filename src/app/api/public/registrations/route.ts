import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAdminContainer } from '@/infrastructure/di';
import { ResponseBuilder } from '@/utils/api/ApiResponse';
import { ConflictError, ValidationError } from '@/utils/errors';
import { PlanType, getPlanLabel } from '@/core/utils/constants/PlanConfig';
import { RegistrationSource } from '@/core/utils/constants/RegistrationConfig';
import { publicRegistrationSchema } from '@/features/registration/schemas/registration.schemas';
import { resolveRegistrationToken } from '@/features/registration/services/registration-link.service';
import { checkRateLimit } from '@/lib/utils/rate-limit';
import {
  memberPhotoPath,
  type MemberPhotoContentType,
} from '@/utils/member-photo';

// ============================================================
// POST /api/public/registrations - QR self-registration (no auth)
// ============================================================

/** Per-IP limit: bursts of forms from one phone/network */
const IP_LIMIT = 5;
const IP_WINDOW_MS = 60_000;

/** Per-gym-token limit: cap total signup velocity per gym */
const TOKEN_LIMIT = 30;
const TOKEN_WINDOW_MS = 60 * 60_000;

/**
 * Public QR self-registration endpoint.
 *
 * Anonymous by design: the unguessable gym token in the body is the only
 * credential. The gym is ALWAYS resolved from the token (never from client
 * input), the plan must be one of that gym's active plan_types, and the
 * amount is taken from the database — the client cannot influence it.
 *
 * On success the member is created immediately (active, initial payment
 * recorded, welcome SMS sent — the desk collects the cash right after) with
 * registration_source='qr', which renders as a NEW badge until the gym
 * verifies the entry. When a photo was captured, the response carries a
 * 5-minute presigned PUT URL so the browser uploads the selfie directly
 * to R2.
 */
export async function POST(request: NextRequest) {
  try {
    // Best-effort abuse dampening before any parsing work
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';
    if (!checkRateLimit(`reg:ip:${ip}`, IP_LIMIT, IP_WINDOW_MS)) {
      return NextResponse.json(
        ResponseBuilder.error('Too many attempts. Please try again shortly.', 'RATE_LIMITED'),
        { status: 429 }
      );
    }

    const body = await request.json();
    const input = publicRegistrationSchema.parse(body);

    if (!checkRateLimit(`reg:token:${input.token}`, TOKEN_LIMIT, TOKEN_WINDOW_MS)) {
      return NextResponse.json(
        ResponseBuilder.error('Too many attempts. Please try again shortly.', 'RATE_LIMITED'),
        { status: 429 }
      );
    }

    // Resolve the gym from the token — the only trust anchor in this flow
    const gymId = await resolveRegistrationToken(input.token);
    if (!gymId) {
      return NextResponse.json(
        ResponseBuilder.notFound('Registration link'),
        { status: 404 }
      );
    }

    // The plan must be one of THIS gym's active plans; amount comes from the DB
    const supabase = createAdminClient();
    const { data: plan, error: planError } = await supabase
      .from('plan_types')
      .select('plan_type, default_amount')
      .eq('gym_id', gymId)
      .eq('plan_type', input.planType)
      .eq('is_active', true)
      .maybeSingle();

    if (planError || !plan) {
      return NextResponse.json(
        ResponseBuilder.validationError({
          planType: ['Selected plan is not available'],
        }),
        { status: 400 }
      );
    }

    const planAmount = Number(plan.default_amount);

    // Create the member through the standard registration use case
    // (admin container: anonymous callers have no RLS session)
    const container = await getAdminContainer();
    const registerMember = container.getRegisterMemberUseCase();

    const result = await registerMember.execute({
      gymId,
      name: input.name,
      phoneNumber: input.phoneNumber,
      planType: input.planType as PlanType,
      planAmount,
      discountId: null,
      recurringDiscount: false,
      membershipStartDate: new Date(),
      paymentAmount: planAmount,
      discount: null,
      registrationSource: RegistrationSource.Qr,
    });

    const member = result.member;

    // Presign the selfie upload and pre-store its deterministic path.
    // If the PUT later fails, the avatar falls back to initials (onError)
    // and the desk can add a photo from the member profile.
    let uploadUrl: string | undefined;
    let photoPath: string | undefined;

    if (input.photoContentType) {
      const contentType = input.photoContentType as MemberPhotoContentType;
      photoPath = memberPhotoPath(member.id, contentType);

      const presign = await container
        .getStorageProvider()
        .getPresignedUploadUrl(photoPath, { contentType });
      uploadUrl = presign.uploadUrl;

      await container.getMemberRepository().update(member.updatePhoto(photoPath));
    }

    return NextResponse.json(
      ResponseBuilder.success(
        {
          memberId: member.id,
          name: member.name,
          planLabel: getPlanLabel(member.planType),
          amountDue: planAmount,
          uploadUrl,
          photoPath,
        },
        { message: 'Registration successful' }
      ),
      { status: 201 }
    );
  } catch (error) {
    console.error('Public registration API error:', error);

    if (error instanceof ConflictError) {
      return NextResponse.json(
        ResponseBuilder.conflict(
          'This phone number is already registered at this gym. Please see the front desk.'
        ),
        { status: 409 }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        ResponseBuilder.validationError({ general: [error.message] }),
        { status: 400 }
      );
    }

    if (error instanceof z.ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of error.issues) {
        const field = issue.path.join('.') || 'general';
        fieldErrors[field] = [...(fieldErrors[field] ?? []), issue.message];
      }
      return NextResponse.json(ResponseBuilder.validationError(fieldErrors), {
        status: 400,
      });
    }

    return NextResponse.json(
      ResponseBuilder.error('Registration failed. Please ask the front desk for help.', 'REGISTRATION_ERROR'),
      { status: 500 }
    );
  }
}
