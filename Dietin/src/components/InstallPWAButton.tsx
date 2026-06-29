import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

export default function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [canPrompt, setCanPrompt] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(display-mode: standalone)')
    const computeInstalled = () => {
      const isStandalone = mql.matches || (navigator as any).standalone === true
      setInstalled(isStandalone)
    }
    computeInstalled()

    const onBIP = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setCanPrompt(true)
    }
    const onInstalled = () => {
      setInstalled(true)
      setCanPrompt(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBIP as any)
    window.addEventListener('appinstalled', onInstalled)
    try { mql.addEventListener?.('change', computeInstalled as any) } catch {}

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP as any)
      window.removeEventListener('appinstalled', onInstalled)
      try { mql.removeEventListener?.('change', computeInstalled as any) } catch {}
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setCanPrompt(false)
      setDeferredPrompt(null)
    }
  }

  // Do not show on iOS (no BIP), or when already installed, or when prompt not available
  if (isIOS() || installed || !canPrompt) return null

  return (
    <div className="fixed bottom-24 right-4 z-[60]">
      <Button onClick={handleInstall} className="h-11 rounded-full shadow-lg px-4 flex items-center gap-2">
        <Download className="h-4 w-4" />
        <span>Install app</span>
      </Button>
    </div>
  )
}
