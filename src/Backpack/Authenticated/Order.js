import axios from 'axios';
import { auth } from './Authentication.js';

class Order {

  async getOpenOrder(symbol, orderId, clientId) {
    const timestamp = Date.now();

     if (!symbol) {
      console.error('symbol required');
      return null;
    }

    if (!orderId && !clientId) {
      console.error('clientId or orderId is required');
      return null;
    }


    const params = {}
    if (symbol) params.symbol = symbol;
    if (orderId) params.orderId = orderId;
    if (clientId) params.clientId = clientId;

    const headers = auth({
      instruction: 'orderQuery',
      timestamp,
      params
    });

    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/order`, {
        headers,
        params
      });
      return response.data
    } catch (error) {
      console.error('getOpenOrder - ERROR!', error.response?.data || error.message);
      return null
    }
  }

  //marketType: "SPOT" "PERP" "IPERP" "DATED" "PREDICTION" "RFQ"
  async getOpenOrders(symbol, marketType = "PERP") {
    const timestamp = Date.now();

    const params = {}
    if (symbol) params.symbol = symbol;
    if (marketType) params.marketType = marketType;

    const headers = auth({
      instruction: 'orderQueryAll',
      timestamp,
      params
    });

    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/orders`, {
        headers,
        params
      });
      return response.data
    } catch (error) {
      console.error('getOpenOrders - ERROR!', error.response?.data || error.message);
      return null
    }
  }

  /*
    {
      "autoLend": true,
      "autoLendRedeem": true,
      "autoBorrow": true,
      "autoBorrowRepay": true,
      "clientId": 0,
      "orderType": "Market",
      "postOnly": true,
      "price": "string",
      "quantity": "string",
      "quoteQuantity": "string",
      "reduceOnly": true,
      "selfTradePrevention": "RejectTaker",
      "side": "Bid",
      "stopLossLimitPrice": "string",
      "stopLossTriggerBy": "string",
      "stopLossTriggerPrice": "string",
      "symbol": "string",
      "takeProfitLimitPrice": "string",
      "takeProfitTriggerBy": "string",
      "takeProfitTriggerPrice": "string",
      "timeInForce": "GTC",
      "triggerBy": "string",
      "triggerPrice": "string",
      "triggerQuantity": "string"
    }
  */

  async executeOrder(body) {

    const timestamp = Date.now();
    const headers = auth({
      instruction: 'orderExecute',
      timestamp,
      params: body
    });

    try {
      const { data } = await axios.post(`${process.env.API_URL}/api/v1/order`, body, {
        headers
      });
      console.log('✅ executeOrder Success!', data.symbol);
      return data;
    } catch (err) {
      console.error('❌ executeOrder - Error!', body, err.response?.data || err.message);
      return null;
    }
  }

  
  async cancelOpenOrder(symbol, orderId, clientId) {
    const timestamp = Date.now();

    if (!symbol) {
      console.error('symbol required');
      return null;
    }

    const params = {}
    if (symbol) params.symbol = symbol;
    if (orderId) params.orderId = orderId;
    if (clientId) params.clientId = clientId;

    const headers = auth({
      instruction: 'orderCancel',
      timestamp,
      params: params 
    });

    try {
      const response = await axios.delete(`${process.env.API_URL}/api/v1/order`, {
        headers,
        data:params
      });
      return response.data
    } catch (error) {
    console.error('cancelOpenOrder - ERROR!', error.response?.data || error.message);
    return null
    }

  }

  async cancelOpenOrders(symbol, orderType) {
    const timestamp = Date.now();

     if (!symbol) {
      console.error('symbol required');
      return null;
    }

    const params = {}
    if (symbol) params.symbol = symbol;
    if (orderType) params.orderType = orderType;

    const headers = auth({
      instruction: 'orderCancelAll',
      timestamp,
      params: params // isso é fundamental para assinatura correta
    });

    try {
      const response = await axios.delete(`${process.env.API_URL}/api/v1/orders`, {
        headers,
        data:params
      });
      return response.data
    } catch (error) {
      console.error('cancelOpenOrders - ERROR!', error.response?.data || error.message);
      return null
    }
  }

}

export default new Order();
