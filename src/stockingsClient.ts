import { Observable } from 'rxjs/Rx'

import { HttpRequest, HttpResponse, RequestFulfiller, defaultRequestFulfiller, StockingsRequest, HttpHeaders, HttpHeadersFromDictionary } from './http'
import { wrapObservable, MessageMappingDictionary } from './wrapObservable'

import { SocketConnection } from './socketConnection'

const TOKEN_HEADER = 'client-token'

export interface StockingsClientOptions<Req extends HttpRequest> {
  socket?: SocketConnection
  socketEndpoint?: string|number
  makeRequest?: RequestFulfiller<Req>
  waitUntilToken?: boolean
}

export class StockingsClient<Req extends HttpRequest> {
  private _socket: SocketConnection
  private _fulfiller: RequestFulfiller<Req>
  private _waitUntilToken: boolean

  constructor (options?: StockingsClientOptions<Req>|SocketConnection|string|number) {
    this._socket = getSocket(options)
    if (!this._socket) {
      throw new Error('Either a socket or socketEndpoint (URL) is required to construct a StockingsClient.')
    }
    this._fulfiller = getFulfiller(options)
    this._waitUntilToken = true
    if (typeof (options as StockingsClientOptions<Req>).waitUntilToken === 'boolean') {
      this._waitUntilToken = (options as StockingsClientOptions<Req>).waitUntilToken
    }
  }

  observeMessages<Out> (type: string): Observable<Out> {
    return this._socket.dataObservable.filter((message) => {
      return message.type === type
    }).map((message) => {
      return message.payload
    })
  }

  unsubscribe (transactionId: string): Promise<void> {
    return this._socket.unsubscribe(transactionId)
  }

  request<T> (req: Req|string, mappings?: MessageMappingDictionary<T>): Observable<T> {
    let request: Req
    if (typeof req === 'string') {
      request = { url: req, method: 'GET' } as Req
    } else {
      request = req
    }

    const makeRequest = () => {
      const responseObservable = convertToObservable(this._fulfiller(request))
      return wrapObservable(responseObservable, this._socket, mappings)
    }

    if (!request.headers) {
      request = (new StockingsRequest(request) as Req)
    }
    
    let headers: HttpHeaders
    if(typeof (request.headers as HttpHeaders).keys === 'function') {
      headers = request.headers as HttpHeaders
    } else {
      request.headers = headers = new HttpHeadersFromDictionary(request.headers as any)
    }

    const token = this._socket.getToken()
    if (token) {
      headers.set(TOKEN_HEADER, token)
      return makeRequest()
    } else if (this._waitUntilToken) {
      let done = false
      return this._socket.tokenObservable.first().flatMap((token) => {
        headers.set(TOKEN_HEADER, token)
        done = true
        return makeRequest()
      })
    }
  }
}

function getFulfiller<Req extends HttpRequest> (options: StockingsClientOptions<Req>|SocketConnection|string|number): RequestFulfiller<Req> {
  if (options instanceof SocketConnection || typeof options === 'string' || typeof options === 'number' || options === null || options === undefined) {
    return defaultRequestFulfiller
  } else {
    if (typeof options.makeRequest === 'function') {
      return options.makeRequest
    }
    return defaultRequestFulfiller
  }
}

function buildLocalEndpoint (port?: number): string {
  let protocol: string
  if (location.protocol.indexOf('https') >= 0) {
    protocol = 'wss:'
  } else {
    protocol = 'ws:'
  }

  let host = location.host
  if (port) {
    if (host.indexOf(':') > 0) {
      host = host.substring(0, host.indexOf(':'))
    }
    host += port
  }

  return `${protocol}//${host}/`
}

function getEndpoint<Req extends HttpRequest> (options: string|number): string {
  if (options === null || options === undefined) {
    return buildLocalEndpoint()
  } if (typeof options === 'string') {
    return options
  } else if (typeof options === 'number') {
    return buildLocalEndpoint(options)
  }
}

function getSocket<Req extends HttpRequest> (options: StockingsClientOptions<Req>|SocketConnection|string|number): SocketConnection {
  if (options instanceof SocketConnection) {
    return options
  } else if (typeof options === 'string' || typeof options === 'number') {
    return makeSocketFromOptions(options)
  } else {
    return options.socket
  }
}

function makeSocketFromOptions<Req extends HttpRequest> (options: string|number): SocketConnection {
  return new SocketConnection(getEndpoint(options))
}

function convertToObservable (res: PromiseLike<HttpResponse>|Observable<HttpResponse>): Observable<HttpResponse> {
  if (res instanceof Observable) {
    return res
  } else if (res instanceof Promise || typeof (res as PromiseLike<HttpResponse>).then === 'function') {
    return Observable.fromPromise(res as Promise<HttpResponse>)
  } else {
    return Observable.throw(new Error('Unrecognized response type -- ' + res.constructor.name + ' : ' + res.toString()))
  }
}
