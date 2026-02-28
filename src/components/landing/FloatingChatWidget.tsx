'use client';

import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export function FloatingChatWidget() {
  const handleClick = () => {
    // TODO: Integrate with actual chat service (Intercom, Crisp, etc.)
    toast.info('Chat feature coming soon! Contact us at info@holtzmanlabs.com');
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 p-4 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-full shadow-2xl hover:scale-110 transition-all duration-300 animate-pulse-ring"
      aria-label="Open chat"
    >
      <MessageCircle className="h-6 w-6" />
    </button>
  );
}
