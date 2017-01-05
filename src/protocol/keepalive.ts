
import {Observable, Subscription} from 'rxjs/rx';

import {SocketConnection} from '../socketConnection';

const ONE_SECOND = 1000;

export function applyKeepalive(connection: SocketConnection) {
  var timeoutId: any;

  function restartTimer() {
    if(timeoutId){
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      connection.restart();
    }, 60 * ONE_SECOND);
  }

  connection.dataObservable.subscribe(restartTimer);
  connection.controlObservable.subscribe(restartTimer);
}