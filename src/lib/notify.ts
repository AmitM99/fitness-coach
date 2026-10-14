/**
 * Local notifications.
 *
 * Everything here is raised by the app on this device — there is no push
 * server, and nothing is sent anywhere. That keeps requirement #1 intact, but
 * it also sets a hard limit: the app can only notify you about something it is
 * awake to observe. See `canScheduleAhead` below.
 */

let registration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    registration = await navigator.serviceWorker.register('/sw.js');

    // Check for a newer worker on every launch rather than waiting for the
    // browser's own schedule.
    void registration.update();

    // When one takes over, reload once so the page is running the code that
    // matches the freshly cached assets.
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    return registration;
  } catch {
    return null;
  }
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (registration) return registration;
  if (!('serviceWorker' in navigator)) return null;
  try {
    registration = (await navigator.serviceWorker.ready) ?? null;
    return registration;
  } catch {
    return null;
  }
}

export function notificationsSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * iOS only surfaces the permission prompt for a web app installed to the home
 * screen. Detecting that lets the UI explain the real prerequisite instead of
 * silently failing.
 */
export function isInstalledStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // Safari's non-standard flag, still the only signal on iOS.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function notify(
  title: string,
  options: { body?: string; tag?: string; silent?: boolean } = {}
): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;

  const reg = await getRegistration();
  // showNotification via the registration is required on iOS; the Notification
  // constructor is not enough there.
  if (!reg?.showNotification) return false;

  try {
    await reg.showNotification(title, {
      body: options.body,
      tag: options.tag,
      icon: '/icon.svg',
      badge: '/icon.svg',
      silent: options.silent,
      requireInteraction: false,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the platform can wake the app for something in the future.
 *
 * It can't — not without a push server. A backgrounded web app on iOS is
 * suspended, so a timer that finishes while you're in another app fires late
 * or not at all. The rest-timer notification is reliable because you are
 * looking at the phone; a "workout tomorrow at 7am" reminder is not, and the
 * UI should not pretend otherwise.
 */
export const canScheduleAhead = false;
