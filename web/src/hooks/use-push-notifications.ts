import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { useCurrentContext } from '#hooks/use-current-context'
import { useOnAppForeground } from '#hooks/use-on-app-foreground'
import { api } from '#lib/api'
import {
  assertOkOrThrow,
  assertOkWithMessage,
  unwrapOrThrow,
} from '#lib/assert-response'
import { getStorageItem, setStorageItem } from '#lib/local-storage'

export type PushNotificationsStatus =
  'loading' | 'unsupported' | 'denied' | 'disabled' | 'enabled'

export type PushAction = 'enable' | 'disable' | 'test'

// The user's explicit opt-in, which neither the permission (still granted after
// an opt-out) nor the subscription (dropped silently by iOS) can stand in for.
const ENABLED_KEY = 'tq:push-enabled'

const pushKeys = {
  state: ['push-subscription-state'] as const,
}

// On iOS, PushManager exists only in a web app added to the home screen.
function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

function isEnabledLocally(): boolean {
  return getStorageItem(ENABLED_KEY).unwrapOr(null) === '1'
}

function setEnabledLocally(enabled: boolean): void {
  setStorageItem(ENABLED_KEY, enabled ? '1' : '0').unwrapOr(undefined)
}

async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

// PushSubscription.toJSON() types every field as optional even though a real
// subscription always carries both keys. An empty value is left for the API to
// reject rather than being smuggled into the stored subscription.
function toSubscriptionKeys(subscription: PushSubscription): {
  p256dh: string
  auth: string
} {
  const { keys } = subscription.toJSON()
  return { p256dh: keys?.['p256dh'] ?? '', auth: keys?.['auth'] ?? '' }
}

async function fetchVapidPublicKey() {
  const res = await api.api.push['vapid-public-key'].$get()
  return unwrapOrThrow(await assertOkWithMessage(res)).json()
}

async function subscribeToPush(context: 'work' | 'personal'): Promise<void> {
  const { publicKey } = await fetchVapidPublicKey()
  const registration = await navigator.serviceWorker.ready

  // An existing subscription is bound to the key it was created with, so reuse
  // it rather than subscribing again with a possibly different one.
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicKey,
    }))

  const res = await api.api.push.subscriptions.$post({
    json: {
      endpoint: subscription.endpoint,
      keys: toSubscriptionKeys(subscription),
      context,
      label: navigator.userAgent,
    },
  })
  assertOkOrThrow(res)

  setEnabledLocally(true)
}

async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getCurrentSubscription()
  await subscription?.unsubscribe()
  // Past the point of no return: the subscription can't come back, so the
  // startup re-subscribe must not resurrect it even if the delete below fails.
  setEnabledLocally(false)

  if (subscription == null) return

  const res = await api.api.push.subscriptions.$delete({
    json: { endpoint: subscription.endpoint },
  })
  assertOkOrThrow(res)
}

async function sendTestPush() {
  const subscription = await getCurrentSubscription()
  if (subscription == null) return null

  const res = await api.api.push.test.$post({
    json: { endpoint: subscription.endpoint },
  })
  return unwrapOrThrow(await assertOkWithMessage(res)).json()
}

async function runPushAction(action: PushAction, context: 'work' | 'personal') {
  switch (action) {
    case 'enable':
      await subscribeToPush(context)
      return null
    case 'disable':
      await unsubscribeFromPush()
      return null
    case 'test':
      return sendTestPush()
  }
}

function resubscribeIfEnabled(context: 'work' | 'personal'): void {
  if (!isPushSupported()) return
  if (!isEnabledLocally()) return
  // Re-subscribing without the permission would prompt outside a user
  // gesture, which browsers reject.
  if (Notification.permission !== 'granted') return

  void subscribeToPush(context).catch((error: unknown) => {
    console.error('failed to refresh the push subscription', error)
  })
}

/**
 * Re-register the subscription on app start and whenever the app returns to
 * the foreground. iOS invalidates a subscription silently, and the machine's
 * context has to reach the server for the sender to filter on it.
 */
export function usePushResubscribe(): void {
  const context = useCurrentContext()

  useEffect(() => {
    resubscribeIfEnabled(context)
  }, [context])

  useOnAppForeground(() => {
    resubscribeIfEnabled(context)
  })
}

function deriveStatus(
  supported: boolean,
  state:
    { endpoint: string | null; permission: NotificationPermission } | undefined,
): PushNotificationsStatus {
  if (!supported) return 'unsupported'
  if (state == null) return 'loading'
  if (state.endpoint != null) return 'enabled'
  return state.permission === 'denied' ? 'denied' : 'disabled'
}

export function usePushNotifications() {
  const context = useCurrentContext()
  const queryClient = useQueryClient()
  const supported = isPushSupported()

  const state = useQuery({
    queryKey: pushKeys.state,
    queryFn: async () => {
      const subscription = await getCurrentSubscription()
      return {
        endpoint: subscription?.endpoint ?? null,
        permission: Notification.permission,
      }
    },
    enabled: supported,
    retry: false,
  })

  // One mutation for all three actions so a failed one's message can't outlive
  // the next action the user takes.
  const action = useMutation({
    mutationFn: (input: PushAction) => runPushAction(input, context),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: pushKeys.state }),
  })

  const report = action.data ?? null

  return {
    status: deriveStatus(supported, state.data),
    context,
    pending: action.isPending ? action.variables : null,
    testSent: report != null && report.sent > 0,
    error:
      action.error?.message ??
      // The API answers 200 with a report even when the push service rejected
      // the endpoint, so a test that sent nothing is the failure signal.
      (report?.sent === 0
        ? 'テスト通知を送信できなかった。購読が失効している可能性があるので、一度無効にしてから有効にし直す'
        : (state.error?.message ?? null)),
    onEnable: () => {
      // Requested straight from the click handler: Safari only shows the prompt
      // while the user gesture is live, which an await would have consumed.
      void Notification.requestPermission()
        .then((permission) => {
          if (permission === 'granted') {
            action.mutate('enable')
            return
          }
          void queryClient.invalidateQueries({ queryKey: pushKeys.state })
        })
        .catch((error: unknown) => {
          console.error('failed to request the notification permission', error)
        })
    },
    onDisable: () => {
      action.mutate('disable')
    },
    onTest: () => {
      action.mutate('test')
    },
  }
}
