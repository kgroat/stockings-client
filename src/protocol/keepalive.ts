
import { SocketConnection } from '../socketConnection'

const ONE_SECOND = 1000

export function applyKeepalive (connection: SocketConnection) {
  let timeoutId: number

  function restartTimer () {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      connection.restart().catch()
    }, 60 * ONE_SECOND)
  }

  connection.dataObservable.subscribe(restartTimer)
  connection.controlObservable.subscribe(restartTimer)
}
