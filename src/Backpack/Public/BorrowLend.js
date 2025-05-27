import axios from 'axios';

class BorrowLend {
  
  async getMarkets() {
    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/borrowLend/markets`);
      return response.data
    } catch (error) {
      console.error('getMarkets - ERROR!', error.response?.data || error.message);
      return null;
    }
  }

  async getHistory(symbol, interval = "1d") {

     if(!symbol){
      console.error('symbol required');
      return null
    }

    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/borrowLend/markets/history`, {
        params:{symbol, interval},
      });
      return response.data
    } catch (error) {
      console.error('getHistory - ERROR!', error.response?.data || error.message);
      return null;
    }
  }

}

export default new BorrowLend();
