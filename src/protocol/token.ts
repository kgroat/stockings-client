
import { Subscriber } from 'rxjs/Rx'

import { SocketConnection } from '../socketConnection'
import { sendData } from '../connectionHelpers'

const CLIENT_TOKEN_TYPE = 'client-token'

const ONE_SECOND = 1000
const THIRTY_SECONDS = 30 * ONE_SECOND

export function applyToken (connection: SocketConnection, tokenSubscribers: Map<string, Subscriber<string>>) {
  let tokenWaiterTimerId: number
  let wasOpen = false
  connection.openObservable.subscribe((isOpen) => {
    if (isOpen && !wasOpen) {
      tokenWaiterTimerId = setTimeout(() => {
        connection.restart().catch()
      }, THIRTY_SECONDS)
    }
    wasOpen = isOpen
  })

  connection.getControl(CLIENT_TOKEN_TYPE).subscribe((token) => {
    sendData(tokenSubscribers, token)
    clearTimeout(tokenWaiterTimerId)
  })
}
