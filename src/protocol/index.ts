
import { Subscriber } from 'rxjs/Rx'

import { SocketConnection } from '../socketConnection'

import { applyKeepalive } from './keepalive'
import { applyPingPong } from './pingPong'
import { applyToken } from './token'
import { applyTransfer } from './transfer'

export interface ProtocolOptions {
  connection: SocketConnection
  tokenSubscribers: Map<string, Subscriber<string>>
}

export function applyProtocol (options: ProtocolOptions) {
  applyKeepalive(options.connection)
  applyPingPong(options.connection)
  applyToken(options.connection, options.tokenSubscribers)
  applyTransfer(options.connection)
}
