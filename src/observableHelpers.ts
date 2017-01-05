
import {Observable, Subscriber} from 'rxjs/Rx';

export function toPromise<T>(observable: Observable<T>, resolveWhen?: (data: T) => boolean): Promise<T> {
  return new Promise<T>((res, rej) => {
    var subscription = observable.catch((err, caught) => {
      subscription.unsubscribe();
      rej(err);
      return caught;
    }).subscribe((data) => {
      if(typeof resolveWhen !== 'function' || resolveWhen(data)){
        subscription.unsubscribe();
        return res(data);
      }
    });
  });
}