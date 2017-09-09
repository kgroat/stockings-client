
import { Observable, Subscriber } from 'rxjs/Rx'

import { SocketMessage, deserializeMessage } from './socketMessage'

export function generateRandomId (): string {
  let output = ''
  for (let i = 0; i < 16; i++) {
    output += generateRandomHexCharacter()
  }
  return output
}

export function makeSubscriberMapObservable<T> (subscribers: Map<string, Subscriber<T>>): Observable<T> {
  return new Observable<T>((sub: Subscriber<T>) => {
    const id = generateRandomId()
    subscribers.set(id, sub)

    return () => {
      subscribers.delete(id)
    }
  })
}

export function makeMessageObservable<T> (observable: Observable<SocketMessage<any>>, type: string, mapping?: (data: any) => T): Observable<T> {
  return observable.filter(msg => msg.type === type).map(msg => {
    let data: T = msg.payload
    if (typeof mapping === 'function') {
      data = mapping(data)
    }
    return data
  })
}

export function sendData<T> (subscribers: Map<string, Subscriber<T>>, data: T) {
  iterableForEach(subscribers.values(), (sub) => sub.next(data))
}

export function sendMessageIfPrefixed<T> (prefix: string, serialData: string, subscribers: Map<string, Subscriber<SocketMessage<T>>>) {
  if (hasPrefix(prefix, serialData)) {
    const message = deserializeMessage(serialData.substring(prefix.length).trim())
    if (message) {
      sendData(subscribers, message)
    }
  }
}

function hasPrefix (prefix: string, data: string): boolean {
  for (let i = 0; i < prefix.length; i++) {
    if (data[i] !== prefix[i]) {
      return false
    }
  }
  return true
}

function generateRandomHexCharacter (): string {
  return Math.floor(Math.random() * 16).toString(16)
}

function iterableForEach<T> (iterator: IterableIterator<T>, process: (item: T) => void) {
  let { done, value } = iterator.next()
  while (!done) {
    process(value)
    let item = iterator.next()
    done = item.done
    value = item.value
  }
}
