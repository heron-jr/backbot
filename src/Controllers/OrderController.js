import Order from '../Backpack/Authenticated/Order.js';
import AccountController from './AccountController.js';
import Utils from '../Utils/Utils.js';
const tickSizeMultiply = 5

class OrderController {

  async forceClose(position) {
    try {
      
    const Account = await AccountController.get()
    const market = Account.markets.find((el) => {
        return el.symbol === position.symbol
    })
    const isLong = parseFloat(position.netQuantity) > 0;
    const quantity = Math.abs(parseFloat(position.netQuantity));
    const decimal = market.decimal_quantity

    const body = {
        symbol: position.symbol,
        orderType: 'Market',
        side: isLong ? 'Ask' : 'Bid', // Ask if LONG , Bid if SHORT
        reduceOnly: true, 
        clientId: Math.floor(Math.random() * 1000000),
        quantity:String(quantity.toFixed(decimal))
    };

    return await Order.executeOrder(body);

    
    } catch (error) {
      console.log(error)
     return null 
    }
  }

  async openOrderSpot({ side, symbol, volume, quantity }) {

    
    
    try {
    
    const body = {
      symbol: symbol,
      side,
      orderType: "Market",
      timeInForce: "GTC",
      selfTradePrevention: "RejectTaker"
    };

    if(quantity) {
      body.quantity = quantity
    } else {
      body.quoteQuantity = volume
    }

    const resp = await Order.executeOrder(body);
    return resp 

    } catch (error) {
      console.log(error)
    }
  }

  async openOrder({ entry, stop, target, action, symbol, volume, decimal_quantity, decimal_price, stepSize_quantity, tickSize }) {
    
    try {
    
    const isLong = action === "long";
    const side = isLong ? "Bid" : "Ask";

    const formatPrice = (value) => parseFloat(value).toFixed(decimal_price).toString();
    const formatQuantity = (value) => parseFloat(value).toFixed(decimal_quantity).toString();

    const entryPrice = parseFloat(entry);

    const quantity = formatQuantity(Math.floor((volume / entryPrice) / stepSize_quantity) * stepSize_quantity);
    const price = formatPrice(entryPrice);

    const body = {
      symbol: symbol,
      side,
      orderType: "Limit",
      postOnly: true,  
      quantity,
      price,
      timeInForce: "GTC",
      selfTradePrevention: "RejectTaker"
    };

    const space = tickSize * tickSizeMultiply
    const takeProfitTriggerPrice = isLong ? target - space : target + space;
    const stopLossTriggerPrice = isLong ? stop + space : stop - space;

   if (target !== undefined && !isNaN(parseFloat(target))) {
      body.takeProfitTriggerBy = "LastPrice";
      body.takeProfitTriggerPrice = formatPrice(takeProfitTriggerPrice);
      body.takeProfitLimitPrice =  formatPrice(target);
    }

    if (stop !== undefined && !isNaN(parseFloat(stop))) {
      body.stopLossTriggerBy = "LastPrice";
      body.stopLossTriggerPrice = formatPrice(stopLossTriggerPrice);
      body.stopLossLimitPrice = formatPrice(stop);
    }

    if(body.quantity > 0 && body.price > 0){
      return await Order.executeOrder(body);
    }

    } catch (error) {
      console.log(error)
    }
  }

  async getRecentOpenOrders(market) {
    const orders = await Order.getOpenOrders(market)
    if(orders) {
      const orderShorted = orders.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      return orderShorted.map((el) => {
          el.minutes = Utils.minutesAgo(el.createdAt)
          el.triggerPrice = Number(el.triggerPrice),
          el.price = Number(el.price)
          return el
      })
    } else {
      return []
    }
    
  }


  
  async getAllOrdersSchedule(markets_open) {
    const orders = await Order.getOpenOrders()
    const orderShorted = orders.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    const list = orderShorted.map((el) => {
        return {
            id: el.id,
            minutes: Utils.minutesAgo(el.createdAt),
            triggerPrice: parseFloat(el.triggerPrice),
            symbol: el.symbol
        }
    })

    return list.filter((el) => !markets_open.includes(el.symbol)) 
  }

  async createStopTS({ symbol, price, isLong, quantity }) {

  const Account = await AccountController.get();
  const find = Account.markets.find(el => el.symbol === symbol);

  if (!find) throw new Error(`Symbol ${symbol} not found in account data`);

  const decimal_quantity = find.decimal_quantity;
  const decimal_price = find.decimal_price;
  const tickSize = find.tickSize * tickSizeMultiply

  if (price <= 0) throw new Error("Invalid price: must be > 0");

  price = Math.abs(price); 
  
  const triggerPrice = isLong ? price - tickSize : price + tickSize  
  const formatPrice = (value) => parseFloat(value).toFixed(decimal_price).toString();
  const formatQuantity = (value) => parseFloat(value).toFixed(decimal_quantity).toString();
  const body = {
    symbol,
    orderType: 'Limit',
    side: isLong ? 'Ask' : 'Bid',
    reduceOnly: true,
    postOnly: true,  
    timeInForce: 'GTC',
    selfTradePrevention: "RejectTaker",
    price: formatPrice(price),
    triggerBy: 'LastPrice',
    triggerPrice: formatPrice(triggerPrice),
    triggerQuantity: formatQuantity(quantity),
  };

  return await Order.executeOrder(body);
  }

  async createLimitOrder(symbol, side, price, quantity) {

     const body = {
          symbol,
          orderType: 'Limit',
          side,
          price: price.toString(),
          quantity: quantity.toString(),
          postOnly: true,
          reduceOnly: false,
          timeInForce: 'GTC',
        };

      try {
        await Order.executeOrder(body);
      } catch (err) {
        console.error("❌ Erro ao criar ordem:", body , err);
      }
  }

  async createLimitOrderGrid(symbol, side, price, quantity, account, clientId) {

    const find = account.markets.find(el => el.symbol === symbol);
    const {decimal_price, decimal_quantity, stepSize_quantity, tickSize} = find

    const formatPrice = (value) => parseFloat(value).toFixed(decimal_price).toString();
    const formatQuantity = (value) => parseFloat(value).toFixed(decimal_quantity).toString();

    const _quantity = formatQuantity(Math.floor(quantity / stepSize_quantity) * stepSize_quantity);

    const isLong = side === "Ask"
    const triggerPrice = isLong ? price - tickSize : price + tickSize  

     const body = {
          symbol,
          orderType: 'Limit',
          side,
          price: formatPrice(price),
          postOnly: true,
          reduceOnly: false,
          quantity : _quantity,
          timeInForce: 'GTC',
          clientId
        };

      try {
        await Order.executeOrder(body);
      } catch (err) {
        console.error("❌ Erro ao criar ordem:", body );
      }
  }

  async createLimitStop(symbol, side, price, quantity) {
      try {
        const body = {
          symbol,
          orderType: 'Limit',
          side,
          price: price.toString(),
          quantity: quantity.toString(),
          postOnly: true,
          reduceOnly: true,
          timeInForce: 'GTC',
        };
        await Order.executeOrder(body);
      } catch (err) {
        console.error("❌ Erro ao criar ordem:", err.message);
      }
  }

   async createLimitTriggerStop(symbol, side, price, quantity, account, markPrice) {


      try {
        const find = account.markets.find(el => el.symbol === symbol);
        const {decimal_price, decimal_quantity, stepSize_quantity} = find
        const formatPrice = (value) => parseFloat(value).toFixed(decimal_price).toString();
        const formatQuantity = (value) => parseFloat(value).toFixed(decimal_quantity).toString();
        const qnt = formatQuantity(Math.floor((quantity) / stepSize_quantity) * stepSize_quantity);

        const tickSize =  Number(find.tickSize) * tickSizeMultiply
        const isLong = side === "Ask"
        const triggerPrice = isLong ? price + tickSize : price - tickSize  

         const body = {
          symbol,
          orderType: 'Limit',
          side,
          price: formatPrice(price),
          postOnly: true,
          reduceOnly: true,
          timeInForce: 'GTC',
          triggerBy :'LastPrice',
          triggerPrice : formatPrice(triggerPrice),
          triggerQuantity : qnt
        };


        await Order.executeOrder(body);
      } catch (err) {
        console.error("❌ Erro ao criar ordem:", err.message);
      }
  }

  async createMarketStop(symbol, side, price, quantity) {
      try {
        const body = {
          symbol,
          orderType: 'Market',
          side,
          price: price.toString(),
          quantity: quantity.toString(),
          reduceOnly: true,
          postOnly: true,
          timeInForce: 'GTC',
        };
        await Order.executeOrder(body);
      } catch (err) {
        console.error("❌ Erro ao criar ordem:", err.message);
      }
  }

}

export default new OrderController();


