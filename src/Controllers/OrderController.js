import Order from '../Backpack/Authenticated/Order.js';
import AccountController from './AccountController.js';
import Utils from '../Utils/Utils.js';

class OrderController {

  async forceClose(position) {
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
  }

 async openOrder({ entry, stop, target, action, market, volume }) {
  const isLong = action === "LONG";
  const side = isLong ? "Bid" : "Ask";

  const Account = await AccountController.get();
  const find = Account.markets.find((el) => el.symbol === market);
  const decimal_quantity = find.decimal_quantity;
  const decimal_price = find.decimal_price;

  const formatPrice = (value) => parseFloat(value).toFixed(decimal_price).toString();
  const formatQuantity = (value) => parseFloat(value).toFixed(decimal_quantity).toString();

  const clientId = Math.floor(Math.random() * 1_000_000);
  const orderType = "Limit";
  const postOnly = false;
  const timeInForce = "GTC";

  const entryPrice = parseFloat(entry);
  const quantity = formatQuantity(volume / entryPrice);
  const price = formatPrice(entryPrice);

  const offset = 0.001 * entryPrice;

  const triggerPrice = isLong
    ? formatPrice(entryPrice - offset)
    : formatPrice(entryPrice + offset);

  const body = {
    autoLend: true,
    autoLendRedeem: true,
    autoBorrow: true,
    autoBorrowRepay: true,
    clientId,
    orderType,
    postOnly,
    selfTradePrevention: "RejectTaker",
    side,
    symbol: market,
    timeInForce,
    price,
    triggerBy: "MarkPrice",
    triggerPrice,
    triggerQuantity: quantity,
  };

  // Stop loss
  if (stop !== undefined && stop !== null && !isNaN(parseFloat(stop))) {
    const stopLoss = parseFloat(stop);
    body.stopLossTriggerBy = "MarkPrice";
    body.stopLossTriggerPrice = isLong
      ? formatPrice(stopLoss + offset)
      : formatPrice(stopLoss - offset);
    body.stopLossLimitPrice = formatPrice(stopLoss);
  }

  // Take profit
  if (target !== undefined && target !== null && !isNaN(parseFloat(target))) {
    const takeProfit = parseFloat(target);
    body.takeProfitTriggerBy = "LastPrice";
    body.takeProfitTriggerPrice = isLong
      ? formatPrice(takeProfit - offset)
      : formatPrice(takeProfit + offset);
    body.takeProfitLimitPrice = formatPrice(takeProfit);
  }

  return await Order.executeOrder(body);
}


  async getRecentOpenOrders(market) {
    const orders = await Order.getOpenOrders(market)
    const orderShorted = orders.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    return orderShorted.map((el) => {
        return {
            id: el.id,
            minutes: Utils.minutesAgo(el.createdAt),
            triggerPrice: parseFloat(el.triggerPrice),
        }
    })
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

  async cancelStopTS(symbol, id) {
    return await Order.cancelOpenOrder(symbol, id)
  }

  async createStopTS({ symbol, price, isLong, quantity }) {
  const Account = await AccountController.get();
  const find = Account.markets.find(el => el.symbol === symbol);

  if (!find) throw new Error(`Symbol ${symbol} not found in account data`);

  const decimal_quantity = find.decimal_quantity;
  const decimal_price = find.decimal_price;

  if (price <= 0) throw new Error("Invalid price: must be > 0");

  price = Math.abs(price); // garante positivo
  const triggerPrice = isLong ? price - 0.01 : price + 0.01;

  const formatPrice = (value) => parseFloat(value).toFixed(decimal_price).toString();
  const formatQuantity = (value) => parseFloat(value).toFixed(decimal_quantity).toString();

  const body = {
    symbol,
    orderType: 'Limit',
    side: isLong ? 'Ask' : 'Bid',
    postOnly: true,
    reduceOnly: true,
    price: formatPrice(price),
    clientId: Math.floor(Math.random() * 1000000),
    timeInForce: 'GTC',
    triggerPrice: formatPrice(triggerPrice),
    triggerBy: 'LastPrice',
    triggerQuantity: formatQuantity(quantity),
  };

  return await Order.executeOrder(body);
}


}

export default new OrderController();


