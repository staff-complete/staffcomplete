/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION: string
  /**
   * Cloudflare Turnstile site key. Unset by default: the early-access form
   * relies on its honeypot until spam actually shows up, at which point
   * setting this and TURNSTILE_SECRET_KEY turns the widget on.
   */
  readonly VITE_TURNSTILE_SITE_KEY?: string
}

interface TurnstileRenderOptions {
  sitekey: string
  callback: (token: string) => void
  'expired-callback'?: () => void
  'error-callback'?: () => void
  theme?: 'light' | 'dark' | 'auto'
}

interface Window {
  turnstile?: {
    render: (container: HTMLElement, options: TurnstileRenderOptions) => string
    reset: (widgetId?: string) => void
  }
}
