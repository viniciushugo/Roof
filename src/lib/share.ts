import { Capacitor } from '@capacitor/core'

interface ShareOptions {
  title: string
  text: string
  url: string
}

/**
 * Share content using the native share sheet (iOS/Android)
 * with a web fallback (navigator.share → clipboard copy).
 */
export async function shareListing(options: ShareOptions): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Share } = await import('@capacitor/share')
    await Share.share({
      title: options.title,
      text: options.text,
      url: options.url,
      dialogTitle: 'Share listing',
    })
  } else if (typeof navigator !== 'undefined') {
    let shareFailed = false

    if (navigator.share) {
      try {
        await navigator.share(options)
        return
      } catch (error: unknown) {
        shareFailed = true

        const err = error as { name?: string; message?: string }
        const name = err?.name
        const message = err?.message || ''

        // If the user explicitly cancels or denies the share, do not fallback.
        if (
          name === 'AbortError' ||
          name === 'NotAllowedError' ||
          message.toLowerCase().includes('cancel')
        ) {
          return
        }
      }
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      // Fallback to copying the URL to the clipboard when share is unavailable
      // or when it failed for a non-user-cancel reason.
      if (!navigator.share || shareFailed) {
        await navigator.clipboard.writeText(options.url)
      }
    }
  }
}
