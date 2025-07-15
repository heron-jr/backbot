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
        params,
        timeout: 15000 // 15 segundos de timeout
      });
      return response.data
    } catch (error) {
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        console.warn('⚠️ getOpenOrders - Timeout, tentando novamente em 2s...');
        // Retry após 2 segundos
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          const retryHeaders = auth({
            instruction: 'orderQueryAll',
            timestamp: Date.now(),
            params
          });
          
          const retryResponse = await axios.get(`${process.env.API_URL}/api/v1/orders`, {
            headers: retryHeaders,
            params,
            timeout: 20000 // Timeout maior na segunda tentativa
          });
          
          console.log('✅ getOpenOrders - Retry bem-sucedido');
          return retryResponse.data;
        } catch (retryError) {
          console.error('❌ getOpenOrders - Retry falhou:', retryError.response?.data || retryError.message);
          return null;
        }
      } else {
        console.error('getOpenOrders - ERROR!', error.response?.data || error.message);
        return null
      }
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
      // Log removido - agora é feito no OrderController com accountId
      return data;
    } catch (err) {
      // Logs removidos - agora são feitos no OrderController com accountId
      // Apenas retorna null para indicar erro
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
