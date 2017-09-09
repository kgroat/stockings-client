import { Observable, Subscriber } from 'rxjs/Rx'

export type HttpMethod = 'GET'|'POST'|'PUT'|'DELETE'|'PATCH'|'HEAD'|'OPTIONS'

export interface HttpRequest {
  url: string
  method: HttpMethod
  search?: string|SearchParams
  headers?: HttpHeaders|{ [key: string]: string }
  body?: any
  responseType?: XMLHttpRequestResponseType
}

export interface HttpResponse {
  body: any
  status: number
  headers: HttpHeaders
}

export interface SearchParams {
  rawParams: string
}

export interface HttpHeaders {
  keys (): string[]
  set (name: string, value: string|string[]): void
  get (name: string): string
  has (name: string): boolean
}

export interface RequestFulfiller<Req extends HttpRequest> {
  (request: Req): Promise<HttpResponse>|Observable<HttpResponse>
}

export class HttpHeadersFromDictionary implements HttpHeaders {
  private _dictionary: Map<string, string> = new Map()

  constructor (dictionary?: { [key: string]: string }) {
    for (let key in dictionary) {
      this.set(key, dictionary[key])
    }
  }

  static parseHeaders (headerStr: string): { [key: string]: string } {
    const headers = {}
    if (!headerStr) {
      return headers
    }
    const headerPairs = headerStr.split('\u000d\u000a')
    for (let i = 0; i < headerPairs.length; i++) {
      const headerPair = headerPairs[i]
      const index = headerPair.indexOf(': ')
      if (index > 0) {
        const key = headerPair.substring(0, index)
        const val = headerPair.substring(index + 2)
        headers[key] = val
      }
    }
    return headers
  }

  keys (): string[] {
    return Object.keys(this._dictionary)
  }

  set (name: string, value: string|string[]): void {
    name = name.toUpperCase()
    if (typeof value === 'string') {
      this._dictionary[name] = value
    } else {
      this._dictionary[name] = value.join(',')
    }
  }

  get (name: string): string {
    name = name.toUpperCase()
    return this._dictionary[name]
  }

  has (name: string): boolean {
    name = name.toUpperCase()
    return this._dictionary.hasOwnProperty(name)
  }
}

export class HttpResponseFromXhr implements HttpResponse {
  body: string|Object|ArrayBuffer|Blob
  status: number
  headers: HttpHeaders

  constructor (xhr: XMLHttpRequest) {
    this.body = xhr.response
    this.status = xhr.status
    const unparsedHeaders = xhr.getAllResponseHeaders()
    const parsedHeaders = HttpHeadersFromDictionary.parseHeaders(unparsedHeaders)
    this.headers = new HttpHeadersFromDictionary(parsedHeaders)
  }
}

export class StockingsRequest implements HttpRequest {
  url: string
  method: HttpMethod
  search?: string|SearchParams
  headers: HttpHeaders = new HttpHeadersFromDictionary()
  body?: any
  responseType?: XMLHttpRequestResponseType

  constructor (options: HttpRequest) {
    this.url = options.url
    this.method = options.method
    this.search = options.search
    this.body = options.body
    this.responseType = options.responseType
    if (options.headers) {
      if (typeof (options.headers as HttpHeaders).keys === 'function') {
        this.headers = options.headers as HttpHeaders
      } else {
        this.headers = new HttpHeadersFromDictionary(options.headers as { [key: string]: string })
      }
    }
  }
}

export function defaultRequestFulfiller (request: HttpRequest): Observable<HttpResponse> {
  return new Observable<HttpResponse>((sub: Subscriber<HttpResponse>) => {
    const xhr = new XMLHttpRequest()

    xhr.open(request.method, getFullUrl(request), true)
    xhr.responseType = request.responseType || 'json'

    let body = request.body
    if (typeof request.body === 'object') {
      body = JSON.stringify(body)
      xhr.setRequestHeader('Content-Type', 'application/json')
    }

    if (request.headers) {
      let headers: HttpHeaders
      if (typeof (request.headers as HttpHeaders).keys === 'function') {
        headers = request.headers as HttpHeaders
      } else {
        headers = new HttpHeadersFromDictionary(request.headers as { [key: string]: string })
      }

      headers.keys().forEach((key) => {
        xhr.setRequestHeader(key, headers.get(key))
      })
    }

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        const response = new HttpResponseFromXhr(xhr)
        if (isSuccessStatus(xhr.status)) {
          sub.next(response)
        } else {
          sub.error(response)
        }
        sub.complete()
      }
    }

    xhr.send(body)
  })
}

function getFullSearchParamsIncludingQueryChar (request: HttpRequest): string {
  let search = ''

  if (typeof request.search === 'object') {
    search = request.search.rawParams
  } else if (typeof request.search === 'string') {
    search = request.search
  }

  if (search && search[0] !== '?') {
    search = '?' + search
  }

  return search
}

function getFullUrl (request: HttpRequest): string {
  return request.url + getFullSearchParamsIncludingQueryChar(request)
}

function isSuccessStatus (statusCode: number): boolean {
  return statusCode >= 200 && statusCode <= 399
}
