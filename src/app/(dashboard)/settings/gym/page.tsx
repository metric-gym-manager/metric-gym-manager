'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { updateGymInfoSchema, type UpdateGymInfoInput } from '@/features/settings/schemas/settings.schemas';
import { Panel, PanelHead } from '@/components/workspace/primitives';
import ProfileImageUpload from '@/features/settings/components/ProfileImageUpload';
import type { GymProfile } from '@/features/auth/types';

/**
 * Settings → Gym Information — App Workspace design. Inline control rows
 * (label left / input right, hairline separated). Same react-hook-form + zod
 * validation and PATCH /api/settings/gym mutation as before.
 */
export default function GymInformationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: gymProfile } = useQuery<GymProfile>({
    queryKey: ['gym-profile'],
    queryFn: async () => {
      const response = await fetch('/api/auth/profile');
      if (!response.ok) throw new Error('Failed to fetch profile');
      const result = await response.json();
      return result.data;
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateGymInfoInput>({ resolver: zodResolver(updateGymInfoSchema) });

  useEffect(() => {
    if (gymProfile) {
      reset({
        gym_name: gymProfile.gym_name,
        gym_address: gymProfile.gym_address || '',
        gym_website: gymProfile.gym_website || '',
      });
    }
  }, [gymProfile, reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: UpdateGymInfoInput) => {
      const response = await fetch('/api/settings/gym', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update gym information');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gym-profile'] });
      setSuccessMessage('Gym information updated');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });

  const handleRegisterNewGym = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/register');
  };

  return (
    <form onSubmit={handleSubmit((d) => updateMutation.mutate(d))} className="flex flex-col gap-3">
      <Panel style={{ overflow: 'hidden' }}>
        <PanelHead
          label="Gym profile"
          right={
            <button type="button" onClick={handleRegisterNewGym} className="mws-btn mws-btn-sm">
              Register new gym
            </button>
          }
        />

        <div style={{ padding: 16 }}>
          {gymProfile ? (
            <ProfileImageUpload currentImageUrl={gymProfile.profile_image_url} gymName={gymProfile.gym_name} />
          ) : (
            <div style={{ height: 96, width: 96, borderRadius: '50%', background: 'rgba(0,0,0,0.06)' }} className="animate-pulse" />
          )}
        </div>

        <div className="mws-row">
          <div>
            <div className="mws-row-title">Gym name</div>
            <div className="mws-row-sub">Shown on receipts and the SMS sender ID</div>
          </div>
          <div style={{ width: 260 }}>
            <input {...register('gym_name')} placeholder="Enter gym name" className="mws-input" style={{ width: '100%' }} />
            {errors.gym_name && <p style={{ fontSize: 11, color: 'var(--mws-err)', marginTop: 4 }}>{errors.gym_name.message}</p>}
          </div>
        </div>

        <div className="mws-row">
          <div>
            <div className="mws-row-title">Address</div>
            <div className="mws-row-sub">Primary location</div>
          </div>
          <div style={{ width: 260 }}>
            <input {...register('gym_address')} placeholder="Enter gym address" className="mws-input" style={{ width: '100%' }} />
            {errors.gym_address && <p style={{ fontSize: 11, color: 'var(--mws-err)', marginTop: 4 }}>{errors.gym_address.message}</p>}
          </div>
        </div>

        <div className="mws-row">
          <div>
            <div className="mws-row-title">Website</div>
            <div className="mws-row-sub">Optional — shown on member-facing pages</div>
          </div>
          <div style={{ width: 260 }}>
            <input {...register('gym_website')} type="url" placeholder="https://www.example.com" className="mws-input" style={{ width: '100%' }} />
            {errors.gym_website && <p style={{ fontSize: 11, color: 'var(--mws-err)', marginTop: 4 }}>{errors.gym_website.message}</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2" style={{ padding: '12px 16px' }}>
          {successMessage && <span style={{ fontSize: 12, color: 'var(--mws-ok)', marginRight: 'auto' }}>{successMessage}</span>}
          {updateMutation.isError && (
            <span style={{ fontSize: 12, color: 'var(--mws-err)', marginRight: 'auto' }}>
              {updateMutation.error instanceof Error ? updateMutation.error.message : 'Failed to save'}
            </span>
          )}
          <button type="button" onClick={() => reset()} disabled={!isDirty || updateMutation.isPending} className="mws-btn mws-btn-sm">Cancel</button>
          <button type="submit" disabled={!isDirty || updateMutation.isPending} className="mws-btn mws-btn-sm mws-btn-primary">
            {updateMutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </Panel>
    </form>
  );
}
