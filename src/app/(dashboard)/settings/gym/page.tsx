'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateGymInfoSchema, type UpdateGymInfoInput } from '@/features/settings/schemas/settings.schemas';
import { Plus } from 'lucide-react';
import ProfileImageUpload from '@/features/settings/components/ProfileImageUpload';

export default function GymInformationPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch current gym profile
  const { data: gymProfile } = useQuery({
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
  } = useForm<UpdateGymInfoInput>({
    resolver: zodResolver(updateGymInfoSchema),
  });

  // Reset form when gym profile is loaded
  useEffect(() => {
    if (gymProfile) {
      reset({
        gym_name: gymProfile.gym_name,
        gym_address: gymProfile.gym_address || '',
        gym_website: gymProfile.gym_website || '',
      });
    }
  }, [gymProfile, reset]);

  // Update gym info mutation
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
      setSuccessMessage('Gym information updated successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });

  const onSubmit = (data: UpdateGymInfoInput) => {
    updateMutation.mutate(data);
  };

  const handleRegisterNewGym = async () => {
    // Log out current user first
    await fetch('/api/auth/logout', { method: 'POST' });
    // Then redirect to registration
    router.push('/register');
  };

  return (
    <div className="max-w-2xl">
      <div className="space-y-6">
        {/* Description */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Gym Information</h2>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleRegisterNewGym}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Register New Gym
          </Button>
        </div>

        {/* Profile Image Upload */}
        <div className="rounded-lg border bg-white p-6">
          {gymProfile ? (
            <ProfileImageUpload
              currentImageUrl={gymProfile.profile_image_url}
              gymName={gymProfile.gym_name}
            />
          ) : (
            <div className="space-y-4">
              <div className="h-6 w-32 bg-gray-200 animate-pulse rounded" />
              <div className="h-24 w-24 rounded-full bg-gray-200 animate-pulse" />
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="rounded-lg border bg-white p-6 space-y-4">
            {/* Gym Name */}
            <div>
              <Label htmlFor="gym_name">Gym Name *</Label>
              <Input
                id="gym_name"
                {...register('gym_name')}
                placeholder="Enter gym name"
              />
              {errors.gym_name && (
                <p className="text-sm text-red-600 mt-1">{errors.gym_name.message}</p>
              )}
            </div>

            {/* Gym Address */}
            <div>
              <Label htmlFor="gym_address">Gym Address</Label>
              <Input
                id="gym_address"
                {...register('gym_address')}
                placeholder="Enter gym address"
              />
              {errors.gym_address && (
                <p className="text-sm text-red-600 mt-1">{errors.gym_address.message}</p>
              )}
            </div>

            {/* Gym Website */}
            <div>
              <Label htmlFor="gym_website">Gym Website</Label>
              <Input
                id="gym_website"
                {...register('gym_website')}
                placeholder="https://www.example.com"
                type="url"
              />
              {errors.gym_website && (
                <p className="text-sm text-red-600 mt-1">{errors.gym_website.message}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Optional: Include your gym&apos;s website URL
              </p>
            </div>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="rounded-md bg-green-50 p-4">
              <p className="text-sm text-green-800">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {updateMutation.isError && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : 'Failed to update gym information'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => reset()}
              disabled={!isDirty || updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isDirty || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
