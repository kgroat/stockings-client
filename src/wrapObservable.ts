import {Observable, Subscriber, Subscription} from 'rxjs/Rx';

import {HttpResponse} from './http';
import {SocketConnection} from './socketConnection';

const SUBSCRIPTION_HEADER = 'client-subscriptions';

interface TransactionSubscription {
  type: string;
  mergeStrategy?: string;
}

interface MergeSubscription<T> {
  data: Observable<T>;
  mergeStrategy: (a: T, b: any) => T;
}

interface SubscriptionObject {
  transactionId: string;
  subscriptions: TransactionSubscription[];
}

export interface MessageMappingDictionary<T> {
  http?: (data: any) => T;
  [type: string]: (data: any) => T;
}

export function wrapObservable<T>(responseObservable: Observable<HttpResponse>, connection: SocketConnection, mappings?: MessageMappingDictionary<T>): Observable<T>{
  return new Observable<T>((sub: Subscriber<T>) => {
    var cleanedUp = false;

    var transactionId: string = '';
    var messageObservables: MergeSubscription<T>[] = [];
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
      
      var value: T;
      if(mappings && mappings.http){
        value = mappings.http(res.body);
      } else {
        value = (<T> res.body);
      }
      sub.next(value);

      
      messageSubscriptions = messageObservables.map((subscription) => {
        return subscription.data.subscribe((data) => {
          value = subscription.mergeStrategy(value, data);
          sub.next(value);
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

function hydrateMergeStrategy<T>(mergeStrategyString: string): (a: T, b: any) => T {
  if(!mergeStrategyString){
    return (a) => a;
  }

  // TODO: This is unsafe and should be replaced with a better algorithm
  return eval(mergeStrategyString);
}

function hydrateSubscriptions<T>(subscriptions: TransactionSubscription[], connection: SocketConnection, mappings?: MessageMappingDictionary<T>): MergeSubscription<T>[] {
  return subscriptions.map((subscription): MergeSubscription<T> => {
    return {
      data: connection.getData<T>(subscription.type, mappings && mappings[subscription.type]),
      mergeStrategy: hydrateMergeStrategy<T>(subscription.mergeStrategy)
    };
  });
}

function getSubscriptionData<T>(subscriptionsJson: string, connection: SocketConnection, mappings?: MessageMappingDictionary<T>): { transactionId: string, data: MergeSubscription<T>[] } {
  if(subscriptionsJson){
    try {
      var subscriptionData: SubscriptionObject = JSON.parse(subscriptionsJson);


      var transactionId = subscriptionData.transactionId;
      var subscriptions = subscriptionData.subscriptions || [];
      var subscriptionObjects = hydrateSubscriptions(subscriptions, connection, mappings);

      return {
        transactionId: transactionId,
        data: subscriptionObjects
      };
    } catch (e) {
      // malformed subscription header; do nothing?
    }
  }
  return null;
}