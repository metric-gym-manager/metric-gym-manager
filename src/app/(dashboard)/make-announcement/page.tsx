'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Send, Megaphone, Clock } from 'lucide-react';
import AnnouncementProgress from '@/components/announcements/AnnouncementProgress';
import type { Announcement } from '@/features/announcements/types';

const MAX_MESSAGE_LENGTH = 160;

export default function MakeAnnouncementPage() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<'all' | 'active' | 'expired'>('all');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [currentAnnouncementId, setCurrentAnnouncementId] = useState<string | null>(null);

  // Fetch past announcements
  const { data: announcements, isLoading } = useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn: async () => {
      const response = await fetch('/api/announcements');
      if (!response.ok) throw new Error('Failed to fetch announcements');
      const result = await response.json();
      return result.data;
    },
  });

  // Send announcement mutation
  const sendMutation = useMutation({
    mutationFn: async ({ message, audience }: { message: string; audience: 'all' | 'active' | 'expired' }) => {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, audience }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send announcement');
      }

      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setMessage('');
      setShowConfirmDialog(false);
      // Set the current announcement ID to show progress
      setCurrentAnnouncementId(result.data.announcement.id);
    },
  });

  const handleSendClick = () => {
    if (message.trim().length === 0) return;
    setShowConfirmDialog(true);
  };

  const handleConfirmSend = () => {
    sendMutation.mutate({ message, audience });
  };

  const remainingChars = MAX_MESSAGE_LENGTH - message.length;
  const isOverLimit = message.length > MAX_MESSAGE_LENGTH;

  return (
    <div className="max-w-4xl">
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-center gap-2 md:gap-3">
          <Megaphone className="h-5 w-5 md:h-6 md:w-6 text-blue-600 shrink-0" />
          <div>
            <h2 className="text-base md:text-lg font-semibold">Make Announcement</h2>
          </div>
        </div>

        {/* Current Announcement Progress */}
        {currentAnnouncementId && (
          <AnnouncementProgress
            announcementId={currentAnnouncementId}
            onComplete={() => {
              queryClient.invalidateQueries({ queryKey: ['announcements'] });
            }}
            onDismiss={() => {
              setCurrentAnnouncementId(null);
            }}
          />
        )}

        {/* Message Composer */}
        <Card className="p-4 md:p-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="audience" className="text-sm md:text-base">Send To</Label>
              <Select value={audience} onValueChange={(value: 'all' | 'active' | 'expired') => setAudience(value)}>
                <SelectTrigger id="audience" className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All members (Active & Expired)</SelectItem>
                  <SelectItem value="active">Active members only</SelectItem>
                  <SelectItem value="expired">Expired members only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <Label htmlFor="message" className="text-sm md:text-base">Announcement Message</Label>
                <span
                  className={`text-xs md:text-sm shrink-0 ${
                    isOverLimit ? 'text-red-600 font-medium' : 'text-gray-500'
                  }`}
                >
                  <span className="hidden sm:inline">{remainingChars} characters remaining</span>
                  <span className="sm:hidden">{remainingChars} left</span>
                </span>
              </div>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your announcement message here..."
                className={`min-h-[100px] md:min-h-[120px] resize-none text-sm md:text-base ${
                  isOverLimit ? 'border-red-500 focus-visible:ring-red-500' : ''
                }`}
                maxLength={MAX_MESSAGE_LENGTH}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button
                onClick={handleSendClick}
                disabled={
                  message.trim().length === 0 || isOverLimit || sendMutation.isPending
                }
                className="gap-2 w-full sm:w-auto"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">{sendMutation.isPending ? 'Sending...' : 'Send Announcement'}</span>
                <span className="sm:hidden">{sendMutation.isPending ? 'Sending...' : 'Send'}</span>
              </Button>
              {message.trim().length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setMessage('')}
                  disabled={sendMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  Clear
                </Button>
              )}
            </div>

            {sendMutation.isError && (
              <p className="text-sm text-red-600">
                {sendMutation.error instanceof Error
                  ? sendMutation.error.message
                  : 'Failed to send announcement'}
              </p>
            )}
          </div>
        </Card>

        {/* Past Announcements */}
        <div>
          <h3 className="text-sm md:text-base font-semibold mb-3 md:mb-4">Past Announcements</h3>
          <div className="space-y-2 md:space-y-3">
            {isLoading ? (
              <Card className="p-4 md:p-6">
                <p className="text-sm text-gray-500 text-center">
                  Loading past announcements...
                </p>
              </Card>
            ) : announcements && announcements.length > 0 ? (
              announcements.map((announcement) => (
                <Card key={announcement.id} className="p-3 md:p-4">
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 md:gap-4">
                      <p className="text-sm text-gray-900 flex-1 leading-snug">
                        {announcement.message}
                      </p>
                      <div className="text-[10px] md:text-xs text-gray-500 shrink-0 flex flex-col md:flex-row md:items-center gap-0.5 md:gap-1">
                        <Clock className="h-3 w-3 hidden md:block" />
                        <span className="whitespace-nowrap">
                          {new Date(announcement.sent_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </span>
                        <span className="whitespace-nowrap">
                          {new Date(announcement.sent_at).toLocaleTimeString('en-GB', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      <span className="hidden sm:inline">Sent to {announcement.recipient_count} member{announcement.recipient_count !== 1 ? 's' : ''}</span>
                      <span className="sm:hidden">{announcement.recipient_count} recipient{announcement.recipient_count !== 1 ? 's' : ''}</span>
                    </p>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-4 md:p-6">
                <div className="text-center space-y-2">
                  <p className="text-sm text-gray-500">
                    No announcements sent yet
                  </p>
                  <p className="text-xs text-gray-400">
                    Use announcements to send important updates to all active and expired members at once — perfect for schedule changes, promotions, or facility updates.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base md:text-lg">Confirm Send Announcement</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              <span className="hidden sm:inline">
                Are you sure you want to send this announcement to{' '}
                {audience === 'all' && 'all active and expired members'}
                {audience === 'active' && 'active members only'}
                {audience === 'expired' && 'expired members only'}
                ? Messages will be sent in the background.
              </span>
              <span className="sm:hidden">
                Send to{' '}
                {audience === 'all' && 'all members'}
                {audience === 'active' && 'active only'}
                {audience === 'expired' && 'expired only'}
                ?
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 md:py-4">
            <div className="rounded-md bg-gray-50 p-3 md:p-4">
              <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{message}</p>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              <span className="hidden sm:inline">
                This will queue SMS messages to{' '}
                {audience === 'all' && 'all active and expired members'}
                {audience === 'active' && 'active members only'}
                {audience === 'expired' && 'expired members only'}
                {' '}in your gym. Messages will be sent in parallel batches for optimal delivery speed.
              </span>
              <span className="sm:hidden">
                SMS will be sent in parallel batches.
              </span>
            </p>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={sendMutation.isPending}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSend}
              disabled={sendMutation.isPending}
              className="gap-2 w-full sm:w-auto"
            >
              <Send className="h-4 w-4" />
              {sendMutation.isPending ? 'Queuing...' : 'Send Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
