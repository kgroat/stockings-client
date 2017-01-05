import {Observable, Subscriber} from 'rxjs/Rx';

export class StockingsHeaders implements HttpHeaders {
  private _headers: Map<string, string> = new Map();
  constructor() {
    
  }
  keys() : string[]{
    var output = [];
    var iterator = this._headers.keys();
    var nxt = iterator.next();
    while(!nxt.done){
      output.push(nxt.value);
      nxt = iterator.next();
    }
    return output;
  }
  set(name: string, value: string|string[]){
    var valueAsString: string;
    if(value instanceof Array){
      valueAsString = value.join(',');
    } else {
      valueAsString = value;
    }
    this._headers.set(name, valueAsString);
  }
  get(name: string) : string {
    return this._headers.get(name);
  }
  has(name: string) : boolean {
    return this._headers.has(name);
  }
}

export class StockingsRequest implements HttpRequest {
  constructor(options: HttpRequest) {
    this.url = options.url;
    this.method = options.method;
    this.search = options.search
    this.body = options.body;
    this.responseType = options.responseType;
    if(options.headers){
      this.headers = options.headers;
    }
  }
  url: string;
  method: string;
  search?: string|SearchParams;
  headers: HttpHeaders = new StockingsHeaders();
  body?: any;
  responseType?: string;
}

export interface HttpRequest {
  url: string;
  method: string;
  search?: string|SearchParams;
  headers?: HttpHeaders;
  body?: any;
  responseType?: string;
}

export interface HttpResponse {
  body: any;
  status: number;
  headers: HttpHeaders;
}

export interface SearchParams {
  rawParams: string;
}

export interface HttpHeaders {
  keys() : string[];
  set(name: string, value: string|string[]) : void;
  get(name: string) : string;
  has(name: string) : boolean;
}

export interface RequestFulfiller<Req extends HttpRequest>{
  (request: Req): Promise<HttpResponse>|Observable<HttpResponse>;
}

export function defaultRequestFulfiller(request: HttpRequest): Observable<HttpResponse> {
  return new Observable<HttpResponse>((sub: Subscriber<HttpResponse>) => {
    var xhr = new XMLHttpRequest();

    xhr.open(request.method, getFullUrl(request), true);
    xhr.responseType = request.responseType || 'json';


    var body = request.body;
    if(typeof request.body === 'object'){
      body = JSON.stringify(body);
      xhr.setRequestHeader('Content-Type', 'application/json');
    }

    if(request.headers){
      request.headers.keys().forEach((key) => {
        xhr.setRequestHeader(key, request.headers.get(key));
      });
    }

    xhr.onreadystatechange = function(){
      if(xhr.readyState == 4) {
        var response = new HttpResponseFromXhr(xhr);
        if(isSuccessStatus(xhr.status)){
          sub.next(response);
        } else {
          sub.error(response);
        }
        sub.complete();
      }
    };

    xhr.send(body);
  });
}

class HttpResponseFromXhr implements HttpResponse {
  constructor(xhr: XMLHttpRequest){
    this.body = xhr.response;
    this.status = xhr.status;
    var unparsedHeaders = xhr.getAllResponseHeaders();
    var parsedHeaders = HttpHeadersFromDictionary.parseHeaders(unparsedHeaders);
    this.headers = new HttpHeadersFromDictionary(parsedHeaders);
  }
  body: string|Object|ArrayBuffer|Blob;
  status: number;
  headers: HttpHeaders;
}

class HttpHeadersFromDictionary implements HttpHeaders {
  private _dictionary: { [key: string]: string };

  constructor(dictionary: { [key: string]: string }){
    this._dictionary = dictionary;
  }
  keys() : string[]{
    return Object.keys(this._dictionary);
  }
  set(name: string, value: string|string[]): void {
    if(typeof value === 'string'){
      this._dictionary[name] = value;
    } else {
      this._dictionary[name] = value.join(',');
    }
  }
  get(name: string): string {
    return this._dictionary[name];
  }
  has(name: string): boolean {
    return this._dictionary.hasOwnProperty(name);
  }

  static parseHeaders(headerStr: string): { [key: string]: string } {
    var headers = {};
    if (!headerStr) {
      return headers;
    }
    var headerPairs = headerStr.split('\u000d\u000a');
    for (var i = 0; i < headerPairs.length; i++) {
      var headerPair = headerPairs[i];
      var index = headerPair.indexOf(': ');
      if (index > 0) {
        var key = headerPair.substring(0, index);
        var val = headerPair.substring(index + 2);
        headers[key] = val;
      }
    }
    return headers;
  }
}

function getFullSearchParamsIncludingQueryChar(request: HttpRequest): string {
  var search = '';

  if(typeof request.search === 'object'){
    search = request.search.rawParams;
  } else if(typeof request.search === 'string'){
    search = request.search;
  }
  
  if(search && search[0] != '?'){
    search = '?' + search;
  }

  return search;
}

function getFullUrl(request: HttpRequest): string {
  return request.url + getFullSearchParamsIncludingQueryChar(request);
}

function isSuccessStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode <= 399;
}