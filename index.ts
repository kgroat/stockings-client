/// <reference path="customTypings/custom.d.ts" />

import {StockingsClient} from './src/stockingsClient';

function StockingsClientStatic(){
  
}

namespace StockingsClientStatic {
  export var StockingsClient = StockingsClient;
}

export default StockingsClientStatic;