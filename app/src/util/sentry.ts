// No-op Sentry stub. The native `@sentry/react-native` pod broke
// against Xcode 26's libc++ const-allocator rules, so the package was
// removed pre-launch. Add it back once we're shipping with a DSN —
// the public API below stays stable so callers don't change.

export function initSentry(): void {
  // no-op
}

export function wrap<P extends object>(
  Component: React.ComponentType<P>,
): React.ComponentType<P> {
  return Component;
}

export function captureError(_err: unknown, _context?: Record<string, unknown>): void {
  // no-op
}

export function setUser(_user: { id: string; email?: string } | null): void {
  // no-op
}
