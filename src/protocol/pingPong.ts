
import { SocketConnection } from '../socketConnection'

const PING_TYPE = 'ping'
const PONG_TYPE = 'pong'

export function applyPingPong (connection: SocketConnection) {
  connection.getControl(PING_TYPE).subscribe((data) => {
    connection.sendControl(PONG_TYPE, data).catch()
  })
}
