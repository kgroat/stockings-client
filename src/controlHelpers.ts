
import {Observable, Subscriber} from 'rxjs/rx';

import {SocketMessage} from './socketMessage';
import {SocketConnection} from './socketConnection';

const ONE_SECOND = 1000;

const UNSUBSCRIBE_TYPE = 'unsubscribe';
const UNSUBSCRIBE_WAIT = 5 * ONE_SECOND;
const UNSUBSCRIBE_ATTEMPT_MAX = 12;

export function unsubscribe(client: SocketConnection, transactionId: string): Promise<void> {
  return new Promise<void>((res, rej) => {
    timedExpectation({
      waitTime: UNSUBSCRIBE_WAIT,
      maxTries: UNSUBSCRIBE_ATTEMPT_MAX,
      controlData: client.controlObservable,
      filter: (msg) => msg.type === UNSUBSCRIBE_TYPE && msg.payload === transactionId,
      attempt: () => client.sendControl(UNSUBSCRIBE_TYPE, transactionId)
    }).subscribe((successful) => {
      if(successful){
        return res();
      }
      client.restart();
      rej(new Error('Did not receive an unsubscribe response from server within 30 seconds'));
    });
  });
}

interface TimedExpectationOptions<T> {
  waitTime: number;
  maxTries: number,
  controlData: Observable<SocketMessage<any>>;
  filter: (msg: SocketMessage<T>) => boolean;
  attempt?: () => void;
  handle?: (data: SocketMessage<T>) => void;
}

function timedExpectation<T>(options: TimedExpectationOptions<T>): Observable<boolean> {
  return new Observable<boolean>((sub: Subscriber<boolean>) => {
    var success = false;
    var successMessageSent = false;

    function cleanup(){
      if(controlSubscription) {
        controlSubscription.unsubscribe();
        controlSubscription = null;
      }
      if(timerSubscription) {
        timerSubscription.unsubscribe();
        timerSubscription = null;
      }
      
      if(!successMessageSent){
        sub.next(success);
        sub.complete();
        successMessageSent = true;
      }
    }

    var controlSubscription = options.controlData.filter(options.filter).subscribe((message) => {
      if(typeof options.handle === 'function'){
        options.handle(message);
      }
      success = true;
      cleanup();
    });

    var timerSubscription = Observable.timer(0, 5000).subscribe((attemptCount) => {
      if(attemptCount >= UNSUBSCRIBE_ATTEMPT_MAX) {
        cleanup();
        return;
      }
      
      if(typeof options.attempt === 'function'){
        options.attempt();
      }
    });
  });
}