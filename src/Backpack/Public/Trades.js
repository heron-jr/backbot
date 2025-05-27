import axios from 'axios';

class Trades {
  
  // max limit = 1000
  async getRecentTrades(symbol, limit = 100) {
    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/trades`, {
        params:{symbol, limit},
      });
      return response.data
    } catch (error) {
      console.error('getRecentTrades - ERROR!', error.response?.data || error.message);
      return null;
    }

  }

  // max limit = 1000
  async getHistoricalTrades(symbol, limit = 100, offset = 0) {

    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/trades/history`, {
        params:{symbol, limit, offset},
      });
      return response.data
    } catch (error) {
      console.error('getHistoricalTrades - ERROR!', error.response?.data || error.message);
      return null;
    }
    
  }


}

export default new Trades();
