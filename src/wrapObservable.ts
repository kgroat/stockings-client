import { Observable, Subscriber, Subscription } from 'rxjs/Rx'

import { HttpResponse } from './http'
import { SocketConnection } from './socketConnection'
import { hydrateMergeStrategy, MergeStrategy, MergeStrategyString } from './mergeStrategyHydrator'

const SUBSCRIPTION_HEADER = 'client-subscriptions'

interface TransactionSubscription {
  type: string
  mergeStrategy?: MergeStrategyString
  upsertKey?: string
}

interface MergeSubscription<T> {
  data: Observable<any>
  mergeStrategy: MergeStrategy<T>
}

interface SubscriptionObject {
  transactionId: string
  subscriptions: TransactionSubscription[]
}

export interface MessageMappingDictionary<T> {
  http?: (data: any) => T
  [type: string]: (data: any) => T
}

export function wrapObservable<T> (responseObservable: Observable<HttpResponse>, connection: SocketConnection, mappings?: MessageMappingDictionary<T>): Observable<T> {
  return new Observable<T>((sub: Subscriber<T>) => {
    let cleanedUp = false

    let transactionId: string = ''
    let messageObservables: MergeSubscription<T>[] = []
    let messageSubscriptions: Subscription[] = []

    let subscriptionsCancelled = false
    function cancelSubscriptions () {
      messageSubscriptions.forEach((sub) => {
        sub.unsubscribe()
      })

      if (transactionId) {
        subscriptionsCancelled = true
        // cancel transactionId
      }
    }

    const responseSubscription = responseObservable.subscribe((res: HttpResponse) => {
      if (res.headers.has(SUBSCRIPTION_HEADER)) {
        const subscriptionData = getSubscriptionData(res.headers.get(SUBSCRIPTION_HEADER), connection, mappings)
        transactionId = subscriptionData.transactionId
        messageObservables = subscriptionData.data
      }

      if (cleanedUp) {
        cancelSubscriptions()
        return
      }

      let value: T
      if (mappings && mappings.http) {
        value = mappings.http(res.body)
      } else {
        value = (res.body as T)
      }
      sub.next(value)

      messageSubscriptions = messageObservables.map((subscription) => {
        return subscription.data.subscribe((data) => {
          const newValue = subscription.mergeStrategy(value, data)
          if (newValue !== undefined) {
            value = newValue
          }
          sub.next(value)
        })
      })
    })

    return function cleanup () {
      cleanedUp = true
      cancelSubscriptions()
      responseSubscription.unsubscribe()
    }
  })
}

function hydrateSubscriptions<T> (subscriptions: TransactionSubscription[], connection: SocketConnection, mappings?: MessageMappingDictionary<T>): MergeSubscription<T>[] {
  return subscriptions.map((subscription): MergeSubscription<T> => {
    return {
      data: connection.getData<T>(subscription.type, mappings && mappings[subscription.type]),
      mergeStrategy: hydrateMergeStrategy<T>(subscription.mergeStrategy, subscription.upsertKey)
    }
  })
}

function getSubscriptionData<T> (subscriptionsJson: string, connection: SocketConnection, mappings?: MessageMappingDictionary<T>): { transactionId: string, data: MergeSubscription<T>[] } {
  if (subscriptionsJson) {
    try {
      const subscriptionData: SubscriptionObject = JSON.parse(subscriptionsJson)

      const transactionId = subscriptionData.transactionId
      const subscriptions = subscriptionData.subscriptions || []
      const subscriptionObjects = hydrateSubscriptions(subscriptions, connection, mappings)

      return {
        transactionId: transactionId,
        data: subscriptionObjects
      }
    } catch (e) {
      console.error(e.stack || e)
      // malformed subscription header do nothing?
    }
  }
  return null
}
