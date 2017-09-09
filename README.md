# Stockings Client
## Client for the socketized observable framework

### Installation
```
npm install stockings-client
```

### Usage

#### Create a client
Minimal configuration:
```javascript
import { StockingsClient } from 'stockings-client'
let client = new StockingsClient() // connects to the host and port of the current URL
```

Specifying port:
```javascript
import { StockingsClient } from 'stockings-client'
let client = new StockingsClient(3000) // connects to the host of the current URL at the specified port
```

Specifying host and port:
```javascript
import { StockingsClient } from 'stockings-client'
let client = new StockingsClient('ws://localhost:3000') // connects to the given host and port
```

Advanced configuraiton with port and/or host:
```javascript
import { StockingsClient, SocketConnection } from 'stockings-client'
let client = new StockingsClient({
  socketEndpoint: 'ws://localhost:3000', // specify host:port or just port
  waitUntilToken: false // don't wait until the token is recieved before making any requests
})
```

Advanced configuraiton with socket connection:
```javascript
import { StockingsClient, SocketConnection } from 'stockings-client'
let connection = new SocketConnection('ws://localhost:3000') // only accepts full host:port
let client = new StockingsClient({
  socket: connection, // specify your own connection
  waitUntilToken: false // don't wait until the token is recieved before making any requests
})
```

#### Make a request
Minimal GET request:
```javascript
function setUser(user) {
  // do something
}
let subscription = client.request('/api/user/123').subscribe(setUser)
```

Using another HTTP method:
```javascript
let subscription = client.request({
  url: '/api/user',
  method: 'POST',
  body: user
}).subscribe()
```

Advanced request:
```javascript
import { HttpHeadersFromDictionary }
let subscription = client.request({
  url: '/api/user',
  method: 'GET',
  search: 'skip=10&limit=5',
  headers: {
    auth: jwt
  },
  responseType: 'blob'
}).subscribe(usersBlob => {
  // do something
})
```

#### Cancelling subscriptions
```javascript
subscription.unsubscribe()
```
Unsubscribing automatically stops listening for any socket events associated with the request, unless it is also used by another open request subscription.

#### Usage with Angular
Setup within module:
```javascript
@NgModule({
  // ...
  providers: [
    // ...
    { provide: StockingsClient, useValue: client }
  ],
  // ...
})
export class AppModule { }
```

Usage within a component
```javascript
@Component({
  selector: 'app-user',
  template: '<div>{{ user | async }}</div>'
})
export class UserComponent implements OnInit {
  @Input() userId: number
  user: Observable<User>

  constructor(private client: StockingsClient) {}

  ngOnInit() {
    this.user = this.client.request<User>(`/api/user/${this.userId}`)
  }
}
```
