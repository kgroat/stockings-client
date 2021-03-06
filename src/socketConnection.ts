
import { Observable, Subscriber } from 'rxjs/Rx'

import { SocketMessage, serializeMessage } from './socketMessage'

import * as connectionHelpers from './connectionHelpers'
import * as controlHelpers from './controlHelpers'

import { toPromise } from './observableHelpers'

import { applyProtocol } from './protocol'

const STOCKINGS_PROTOCOL = 'stockings'

const DATA_PREFIX = 'm:'
const CONTROL_PREFIX = 'c:'

const ONE_SECOND = 1000

export class SocketConnection {
  readonly openObservable: Observable<boolean>
  readonly dataObservable: Observable<SocketMessage<any>>
  readonly controlObservable: Observable<SocketMessage<any>>
  readonly tokenObservable: Observable<string>

  private readonly _endpoint: string
  private _isConnecting: boolean
  private _isOpen: boolean
  private _isClosed: boolean

  private readonly _openSubscribers: Map<string, Subscriber<boolean>> = new Map()
  private readonly _dataSubscribers: Map<string, Subscriber<SocketMessage<any>>> = new Map()
  private readonly _controlSubscribers: Map<string, Subscriber<SocketMessage<any>>> = new Map()
  private readonly _tokenSubscribers: Map<string, Subscriber<string>> = new Map()

  private _socket: WebSocket
  private _token: string

  constructor (endpoint: string) {
    this._endpoint = endpoint
    this._isConnecting = this._isOpen = this._isClosed = false

    this.openObservable = connectionHelpers.makeSubscriberMapObservable(this._openSubscribers)
    this.dataObservable = connectionHelpers.makeSubscriberMapObservable(this._dataSubscribers)
    this.controlObservable = connectionHelpers.makeSubscriberMapObservable(this._controlSubscribers)
    this.tokenObservable = connectionHelpers.makeSubscriberMapObservable(this._tokenSubscribers)
    this.tokenObservable.subscribe((token) => this._token = token)

    applyProtocol({
      connection: this,
      tokenSubscribers: this._tokenSubscribers
    })

    this._forceReconnect()
  }

  getData<T> (type: string, mapping?: (data: any) => T): Observable<T> {
    return connectionHelpers.makeMessageObservable(this.dataObservable, type, mapping)
  }

  getControl<T> (type: string, mapping?: (data: any) => T): Observable<T> {
    return connectionHelpers.makeMessageObservable(this.controlObservable, type, mapping)
  }

  sendData (type: string, payload: any): Promise<void> {
    return this._sendRaw(DATA_PREFIX + serializeMessage(type, payload))
  }

  sendControl (type: string, payload: any): Promise<void> {
    return this._sendRaw(CONTROL_PREFIX + serializeMessage(type, payload))
  }

  unsubscribe (transactionId: string): Promise<void> {
    return controlHelpers.unsubscribe(this, transactionId)
  }

  waitUntilOpen (): Promise<boolean> {
    return Promise.resolve(this._isOpen).then((isOpen) => {
      return isOpen || toPromise(this.openObservable, open => open)
    })
  }

  isOpen (): boolean {
    return this._isOpen
  }

  getToken (): string {
    if (!this._isOpen) {
      return null
    }
    return this._token
  }

  restart (): Promise<boolean> {
    this._forceReconnect()
    return this.waitUntilOpen()
  }

  private _sendRaw (rawData: string): Promise<void> {
    return this.waitUntilOpen().then(() => this._socket.send(rawData))
  }

  private _reconnect () {
    if (!this._isOpen && !this._isConnecting) {
      this._forceReconnect()
    }
  }

  private _forceReconnect () {
    try {
      this._setSocket(new WebSocket(this._endpoint, STOCKINGS_PROTOCOL))
    } catch (e) {
      setTimeout(() => this._forceReconnect(), 15 * ONE_SECOND)
    }
  }

  private _setSocket (socket: WebSocket) {

    if (this._socket) {
      this._socket.removeEventListener('open', this.openListener)
      this._socket.removeEventListener('close', this.closeListener)
      this._socket.removeEventListener('error', this.errorListener)
      this._socket.removeEventListener('message', this.messageListener)
      this._socket.close()
    }
    this._isConnecting = true
    this._isOpen = this._isClosed = false

    socket.addEventListener('open', this.openListener)
    socket.addEventListener('close', this.closeListener)
    socket.addEventListener('error', this.errorListener)
    socket.addEventListener('message', this.messageListener)

    this._socket = socket
  }

  private openListener = (ev) => {
    this._isConnecting = false
    this._isOpen = true
    connectionHelpers.sendData(this._openSubscribers, this._isOpen)
  }

  private closeListener = (ev) => {
    this._isConnecting = this._isOpen = false
    this._isClosed = true
    connectionHelpers.sendData(this._openSubscribers, this._isOpen)
    setTimeout(() => {
      this._reconnect()
    }, 15 * ONE_SECOND)
  }

  private errorListener = (ev) => {
    this.closeListener(ev)
  }

  private messageListener = (ev) => {
    const data = (ev.data as string)
    connectionHelpers.sendMessageIfPrefixed(DATA_PREFIX, data, this._dataSubscribers)
    connectionHelpers.sendMessageIfPrefixed(CONTROL_PREFIX, data, this._controlSubscribers)
  }
}
