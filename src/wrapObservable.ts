import {Observable, Subscriber, Subscription} from 'rxjs/Rx';

import {HttpResponse} from './http';
import {SocketConnection} from './socketConnection';

const SUBSCRIPTION_HEADER = 'client-subscriptions';

interface SubscriptionObject {
  transactionId: string;
  subscriptions: string[];
}

export interface MessageMappingDictionary<T> {
  http?: (data: any) => T;
  [type: string]: (data: any) => T;
}

export function wrapObservable<T>(responseObservable: Observable<HttpResponse>, connection: SocketConnection, mappings?: MessageMappingDictionary<T>): Observable<T>{
  return new Observable<T>((sub: Subscriber<T>) => {
    var cleanedUp = false;

    var transactionId: string = '';
    var messageObservables: Observable<T>[] = [];
    var messageSubscriptions: Subscription[] = [];

    var subscriptionsCancelled = false;
    function cancelSubscriptions(){
      messageSubscriptions.forEach((sub) => {
        sub.unsubscribe();
      });

      if(transactionId){
        subscriptionsCancelled = true;
        // cancel transactionId
      }
    }

    var responseSubscription = responseObservable.subscribe((res: HttpResponse) => {
      if(res.headers.has(SUBSCRIPTION_HEADER)){
        var subscriptionData = getSubscriptionData(res.headers.get(SUBSCRIPTION_HEADER), connection, mappings);
        transactionId = subscriptionData.transactionId;
        messageObservables = subscriptionData.data;
      }

      if(cleanedUp){
        cancelSubscriptions();
        return;
      }
      
      var responseBody: T;
      if(mappings && mappings.http){
        responseBody = mappings.http(res.body);
      } else {
        responseBody = (<T> res.body);
      }
      sub.next(responseBody);

      
      messageSubscriptions = messageObservables.map((obs) => {
        return obs.subscribe((data) => {
          sub.next(data);
        });
      });
    });

    return function cleanup(){
      cleanedUp = true;
      cancelSubscriptions();
      responseSubscription.unsubscribe();
    };
  });
}

function buildObservables<T>(types: string[], connection: SocketConnection, mappings?: MessageMappingDictionary<T>): Observable<T>[] {
  return types.map((type): Observable<T> => {
    return connection.getData(type, mappings && mappings[type]);
  });
}

function getSubscriptionData<T>(subscriptionsJson: string, connection: SocketConnection, mappings?: MessageMappingDictionary<T>): { transactionId: string, data: Observable<T>[] } {
  if(subscriptionsJson){
    try {
      var subscriptionData: SubscriptionObject = JSON.parse(subscriptionsJson);
      var transactionId = subscriptionData.transactionId;
      var subscriptions = subscriptionData.subscriptions || [];
      var messageObservables = buildObservables(subscriptions, connection, mappings);

      return {
        transactionId: transactionId,
        data: messageObservables
      };
    } catch (e) {
      // malformed subscription header; do nothing?
    }
  }
  return null;
}