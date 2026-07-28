'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui'
import { Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// iOS never fires beforeinstallprompt, so the manual instructions are shown
// based on a static user-agent snapshot (never changes within a session)
const emptySubscribe = () => () => {}
const getServerIosSnapshot = () => false
const getIosPromptSnapshot = () => {
  const userAgent = window.navigator.userAgent.toLowerCase()
  const isIos = /iphone|ipad|ipod/.test(userAgent)
  const isStandalone =
    'standalone' in window.navigator &&
    !!(window.navigator as Navigator & { standalone?: boolean }).standalone
  return isIos && !isStandalone
}

export function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const showIosPrompt = useSyncExternalStore(
    emptySubscribe,
    getIosPromptSnapshot,
    getServerIosSnapshot
  )

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    console.log(`User response to install prompt: ${outcome}`)
    setDeferredPrompt(null)
  }

  // Chrome/Edge/Android: show native install button
  if (deferredPrompt) {
    return (
      <Button
        onClick={handleInstallClick}
        size="lg"
        variant="accent"
        className="px-8 gap-2"
      >
        <Download className="w-4 h-4" />
        Install App
      </Button>
    )
  }

  // iOS: show instructions tooltip
  if (showIosPrompt) {
    return (
      <Button
        size="lg"
        variant="secondary"
        className="px-8 gap-2"
        onClick={() =>
          alert(
            'To install this app on your iPhone:\n\n1. Tap the Share icon at the bottom of Safari\n2. Select "Add to Home Screen"\n3. Tap "Add"'
          )
        }
      >
        <Download className="w-4 h-4" />
        Install App
      </Button>
    )
  }

  return null
}
