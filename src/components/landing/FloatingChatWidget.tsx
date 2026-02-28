'use client';

import { MessageCircle } from 'lucide-react';

export function FloatingChatWidget() {
  const whatsappNumber = '94704379967'; // Sri Lanka country code + 0704379967
  const whatsappMessage = 'Hi! I would like to learn more about Metric Gym Manager.';
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 p-4 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-full shadow-2xl hover:scale-110 transition-all duration-300 animate-pulse-ring"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}
