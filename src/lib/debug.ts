// ============================================================================
// SPACE FORTRESS - Debug Mode Configuration
// ============================================================================
//
// Debug mode provides enhanced error visibility for development and testing.
// When enabled:
// - Errors trigger browser alerts (visible in Playwright)
// - Errors are exposed to window for programmatic access
// - Console logging is verbose
//
// Enable via:
// - URL param: ?debug=true
// - localStorage: localStorage.setItem('debug', 'true')
// - Environment: Always enabled in dev mode
// ============================================================================

import { browser } from '$app/environment'
import { dev } from '$app/environment'

// Check if debug mode is enabled
function checkDebugMode(): boolean {
  if (!browser) return false

  // Always debug in dev mode
  if (dev) return true

  // Check URL param
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('debug') === 'true') return true

  // Check localStorage
  if (localStorage.getItem('debug') === 'true') return true

  return false
}

export const DEBUG = browser ? checkDebugMode() : false

// Error history for debugging
interface DebugError {
  message: string
  timestamp: string
  stack?: string
  context?: string
}

const errorHistory: DebugError[] = []
const MAX_ERROR_HISTORY = 20

// Expose debug utilities to window in debug mode
if (browser && DEBUG) {
  ;(window as any).__spacefortress = {
    debug: true,
    getLastError: () => errorHistory[errorHistory.length - 1] || null,
    getErrorHistory: () => [...errorHistory],
    clearErrors: () => { errorHistory.length = 0 }
  }
  console.log('%c[Space Fortress Debug Mode Enabled]', 'color: #00ff00; font-weight: bold')
}

// Log and optionally alert on errors
export function debugError(message: string, context?: string, originalError?: Error): void {
  const debugErr: DebugError = {
    message,
    timestamp: new Date().toISOString(),
    context,
    stack: originalError?.stack
  }

  // Add to history
  errorHistory.push(debugErr)
  if (errorHistory.length > MAX_ERROR_HISTORY) {
    errorHistory.shift()
  }

  // Update window reference
  if (browser) {
    ;(window as any).__lastGameError = debugErr
  }

  if (DEBUG) {
    // Verbose console logging
    console.error(
      `%c[Game Error]%c ${context ? `[${context}] ` : ''}${message}`,
      'color: #ff4444; font-weight: bold',
      'color: #ff8888'
    )
    if (originalError?.stack) {
      console.error('Stack trace:', originalError.stack)
    }

    // Alert for visibility in Playwright and manual testing
    if (browser) {
      // Use setTimeout to not block the current execution
      setTimeout(() => {
        window.alert(`[Game Error] ${message}`)
      }, 0)
    }
  }
}

// Log debug info (only in debug mode)
export function debugLog(message: string, ...args: any[]): void {
  if (DEBUG) {
    console.log(`%c[Debug]%c ${message}`, 'color: #4488ff; font-weight: bold', 'color: inherit', ...args)
  }
}

// Log game events (only in debug mode)
export function debugEvent(eventType: string, data?: any): void {
  if (DEBUG) {
    console.log(
      `%c[Event]%c ${eventType}`,
      'color: #44ff88; font-weight: bold',
      'color: inherit',
      data ? data : ''
    )
  }
}
