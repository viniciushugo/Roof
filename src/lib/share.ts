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
  } else if (navigator.share) {
    await navigator.share(options)
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(options.url)
  }
}
