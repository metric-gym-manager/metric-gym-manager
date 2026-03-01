'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIosPrompt, setShowIosPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    // iOS detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);
    const isStandalone =
      'standalone' in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone;

    if (isIos && !isStandalone) {
      setShowIosPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
  };

  // Chrome/Edge/Android: show native install button
  if (deferredPrompt) {
    return (
      <Button
        onClick={handleInstallClick}
        size="lg"
        className="bg-brand-accent hover:bg-brand-accent/90 text-white px-8 gap-2"
      >
        <Download className="w-4 h-4" />
        Install App
      </Button>
    );
  }

  // iOS: show instructions tooltip
  if (showIosPrompt) {
    return (
      <Button
        size="lg"
        variant="outline"
        className="bg-white/10 text-white border-white hover:bg-white/20 px-8 gap-2"
        onClick={() =>
          alert(
            'To install this app on your iPhone:\n\n1. Tap the Share icon at the bottom of Safari\n2. Select "Add to Home Screen"\n3. Tap "Add"'
          )
        }
      >
        <Download className="w-4 h-4" />
        Install App
      </Button>
    );
  }

  return null;
}
