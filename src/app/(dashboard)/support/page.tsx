'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Phone, MessageCircle, Headset, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function SupportPage() {
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackEmail, setFeedbackEmail] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState<'bug' | 'feature' | 'general'>('general');

  const feedbackMutation = useMutation({
    mutationFn: async (data: { message: string; email?: string; category: string }) => {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send feedback');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Feedback sent successfully! Thank you for helping us improve.');
      setFeedbackMessage('');
      setFeedbackEmail('');
      setFeedbackCategory('general');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to send feedback');
    },
  });

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMessage.trim()) {
      toast.error('Please enter your feedback message');
      return;
    }
    feedbackMutation.mutate({
      message: feedbackMessage,
      email: feedbackEmail || undefined,
      category: feedbackCategory,
    });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-blue-100 p-4">
              <Headset className="h-12 w-12 text-blue-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Support</h1>
          <p className="text-gray-500 mt-2">
            We&apos;re here to help with any technical difficulties, failures, or suggestions
          </p>
        </div>

        {/* Contact Card */}
        <Card className="p-8">
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="space-y-4">
              {/* Phone Contact */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-blue-50 border border-blue-100">
                <div className="shrink-0">
                  <div className="rounded-full bg-blue-600 p-3">
                    <Phone className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">Call or WhatsApp</p>
                  <a
                    href="tel:0704379967"
                    className="text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    070 437 9967
                  </a>
                </div>
              </div>

              {/* WhatsApp Button */}
              <div className="flex gap-3">
                <Button
                  asChild
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  <a
                    href="https://wa.me/94704379967"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="h-5 w-5" />
                    WhatsApp
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  <a href="tel:0704379967" className="flex items-center justify-center gap-2">
                    <Phone className="h-5 w-5" />
                    Call Now
                  </a>
                </Button>
              </div>
            </div>

            {/* Support Hours */}
            <div className="border-t border-gray-200 pt-6">
              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Support Hours</h3>
                <p className="text-sm text-gray-600">
                  Monday - Sunday: 8:00 AM - 10:00 PM
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  We typically respond within a few hours during business hours
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Send Feedback Form */}
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Send Feedback</h2>
              <p className="text-sm text-gray-500 mt-1">
                Help us improve by sharing your suggestions, reporting bugs, or requesting features.
              </p>
            </div>

            <form onSubmit={handleSubmitFeedback} className="space-y-4">
              <div>
                <Label htmlFor="feedback-category">Category</Label>
                <Select
                  value={feedbackCategory}
                  onValueChange={(value: 'bug' | 'feature' | 'general') => setFeedbackCategory(value)}
                >
                  <SelectTrigger id="feedback-category" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Feedback</SelectItem>
                    <SelectItem value="bug">Bug Report</SelectItem>
                    <SelectItem value="feature">Feature Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="feedback-email">Email (optional)</Label>
                <Input
                  id="feedback-email"
                  type="email"
                  value={feedbackEmail}
                  onChange={(e) => setFeedbackEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="mt-1.5"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Provide your email if you&apos;d like us to follow up with you.
                </p>
              </div>

              <div>
                <Label htmlFor="feedback-message">Your Feedback *</Label>
                <Textarea
                  id="feedback-message"
                  value={feedbackMessage}
                  onChange={(e) => setFeedbackMessage(e.target.value)}
                  placeholder="Tell us what's on your mind..."
                  className="mt-1.5 min-h-[120px] resize-none"
                  maxLength={1000}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {1000 - feedbackMessage.length} characters remaining
                </p>
              </div>

              <Button
                type="submit"
                disabled={feedbackMutation.isPending || !feedbackMessage.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Send className="h-4 w-4 mr-2" />
                {feedbackMutation.isPending ? 'Sending...' : 'Send Feedback'}
              </Button>
            </form>
          </div>
        </Card>

        {/* Additional Info */}
        <div className="text-center text-sm text-gray-500">
          <p>Thank you for using Metric Gym Manager!</p>
          <p className="mt-1">We appreciate your feedback and are here to help.</p>
        </div>
      </div>
    </div>
  );
}
