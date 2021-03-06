
import { Observable, Subscription } from 'rxjs/Rx'

import { SocketConnection } from '../socketConnection'

const TRANSFER_TYPE = 'client-change'

const ONE_SECOND = 1000

const MAX_TRIES = 12

export function applyTransfer (connection: SocketConnection) {
  let oldToken: string
  connection.tokenObservable.subscribe((token) => {
    if (oldToken) {
      const tokenToTransfer = oldToken
      let transferSubscription: Subscription
      let intervalSubscription: Subscription
      transferSubscription = connection.getControl<string>(TRANSFER_TYPE).subscribe((newToken) => {
        if (newToken === tokenToTransfer) {
          intervalSubscription.unsubscribe()
          transferSubscription.unsubscribe()
        }
      })
      intervalSubscription = Observable.timer(0, 5 * ONE_SECOND).subscribe((i) => {
        if (i >= MAX_TRIES) {
          intervalSubscription.unsubscribe()
          transferSubscription.unsubscribe()
          return
        }
        connection.sendControl(TRANSFER_TYPE, tokenToTransfer).catch()
      })
    }
    oldToken = token
  })
}
