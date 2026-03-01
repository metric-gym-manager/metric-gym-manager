'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
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
    mutationFn: async (message: string) => {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
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
    sendMutation.mutate(message);
  };

  const remainingChars = MAX_MESSAGE_LENGTH - message.length;
  const isOverLimit = message.length > MAX_MESSAGE_LENGTH;

  return (
    <div className="max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Megaphone className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold">Make Announcement</h2>
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
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="message">Announcement Message</Label>
                <span
                  className={`text-sm ${
                    isOverLimit ? 'text-red-600 font-medium' : 'text-gray-500'
                  }`}
                >
                  {remainingChars} characters remaining
                </span>
              </div>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your announcement message here..."
                className={`min-h-[120px] resize-none ${
                  isOverLimit ? 'border-red-500 focus-visible:ring-red-500' : ''
                }`}
                maxLength={MAX_MESSAGE_LENGTH}
              />
              <p className="text-xs text-gray-500 mt-2">
                Your message will be sent to all active and expired members in your gym.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSendClick}
                disabled={
                  message.trim().length === 0 || isOverLimit || sendMutation.isPending
                }
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                {sendMutation.isPending ? 'Sending...' : 'Send Announcement'}
              </Button>
              {message.trim().length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setMessage('')}
                  disabled={sendMutation.isPending}
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
          <h3 className="text-base font-semibold mb-4">Past Announcements</h3>
          <div className="space-y-3">
            {isLoading ? (
              <Card className="p-6">
                <p className="text-sm text-gray-500 text-center">
                  Loading past announcements...
                </p>
              </Card>
            ) : announcements && announcements.length > 0 ? (
              announcements.map((announcement) => (
                <Card key={announcement.id} className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm text-gray-900 flex-1">
                        {announcement.message}
                      </p>
                      <div className="text-xs text-gray-500 whitespace-nowrap flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(announcement.sent_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Sent to {announcement.recipient_count} member
                      {announcement.recipient_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-6">
                <p className="text-sm text-gray-500 text-center">
                  No announcements sent yet
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Send Announcement</DialogTitle>
            <DialogDescription>
              Are you sure you want to send this announcement to all active and expired
              members? Messages will be sent in the background.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-md bg-gray-50 p-4">
              <p className="text-sm text-gray-900 whitespace-pre-wrap">{message}</p>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              This will queue SMS messages to all active and expired members in your gym. Messages will be sent in parallel batches for optimal delivery speed.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={sendMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSend}
              disabled={sendMutation.isPending}
              className="gap-2"
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
