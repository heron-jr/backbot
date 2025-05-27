import axios from 'axios';
import Utils from '../../utils/Utils.js';

class Markets {

  async getMarkets() {
    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/markets`);
      return response.data
    } catch (error) {
      console.error('getMarkets - ERROR!', error.response?.data || error.message);
      return null;
    }
  }

  async getMarket(symbol) {

    if(!symbol){
      console.error('symbol required');
      return null
    }

    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/market`, {
        params:{symbol},
      })
      return response.data
    } catch (error) {
      console.error('getMarket - ERROR!', error.response?.data || error.message);
      return null;
    }
  }

  async getTickers(interval = "1d") {
    try {
      
      const response = await axios.get(`${process.env.API_URL}/api/v1/tickers`, {
        params:{interval},
      })

      return response.data
    } catch (error) {
      console.error('getTickers - ERROR!', error.response?.data || error.message);
      return null;
    }
  }

  async getTicker(symbol, interval = "1d") {
    
    if(!symbol){
      console.error('symbol required');
      return null
    }

    try {

     const response = await axios.get(`${process.env.API_URL}/api/v1/ticker`, {
        params:{symbol, interval},
      })

      return response.data
    } catch (error) {
      console.error('getTicker - ERROR!', error.response?.data || error.message);
      return null;
    }
  }

  async getDepth(symbol) {

    if(!symbol){
      console.error('symbol required');
      return null
    }

    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/depth`, {
        params:{symbol},
      })
      return response.data
    } catch (error) {
      console.error('getDepth - ERROR!', error.response?.data || error.message);
      return null;
    }
  }




  async getKLines(symbol, interval, limit) {

     if(!symbol){
      console.error('symbol required');
      return null
    }

     if(!interval){
      console.error('interval required');
      return null
    }

     if(!limit){
      console.error('limit required');
      return null
    }

    try {
    const timestamp = Date.now();
    const now = Math.floor(timestamp / 1000);
    const duration = Utils.getIntervalInSeconds(interval) * limit;
    const startTime = now - duration;
    const endTime = now;

    const url = `${process.env.API_URL}/api/v1/klines`;

    const response = await axios.get(url, {
      params: {
        symbol,
        interval,
        startTime,
        endTime
      }
    });

    const data = response.data;
    return data
  } catch (error) {
    console.error('getKLines - ERROR!', error.response?.data || error.message);
    return null;
  }
  }

  async getAllMarkPrices(symbol) {
    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/markPrices`, {
        params:{symbol},
      })
      return response.data
    } catch (error) {
      console.error('getAllMarkPrices - ERROR!', error.response?.data || error.message);
      return null;
    }
  }

  async getOpenInterest(symbol) {
    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/openInterest`, {
        params:{symbol},
      })
      return response.data
    } catch (error) {
      console.error('getOpenInterest - ERROR!', error.response?.data || error.message);
      return null;
    }
  }

  async getFundingIntervalRates(symbol, limit = 100, offset = 0) {
    
    if(!symbol){
      console.error('symbol required');
      return null
    }

    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/fundingRates`, {
        params:{symbol, limit, offset},
      })
      return response.data
    } catch (error) {
      console.error('getFundingIntervalRates - ERROR!', error.response?.data || error.message);
      return null;
    }
  }

}

export default new Markets();
