
import {Subscription, Subscriber} from 'rxjs/rx';

import {SocketConnection} from '../socketConnection';
import {SocketMessage} from '../socketMessage';

import {applyKeepalive} from './keepalive';
import {applyPingPong} from './pingPong';
import {applyToken} from './token';
import {applyTransfer} from './transfer';

export interface ProtocolOptions {
  connection: SocketConnection;
  tokenSubscribers: Map<string, Subscriber<string>>;
}

export function applyProtocol(options: ProtocolOptions){
  var protocolOverhead: Subscription[] = [];
  applyKeepalive(options.connection);
  applyPingPong(options.connection);
  applyToken(options.connection, options.tokenSubscribers);
  applyTransfer(options.connection);
}