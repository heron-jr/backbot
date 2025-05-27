import axios from 'axios';
import { auth } from './Authentication.js';

class BorrowLend {
  
  async getBorrowLendPositionQuery() {
    const timestamp = Date.now();

    const headers = auth({
      instruction: 'borrowLendPositionQuery',
      timestamp,
    });

    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/borrowLend/positions`, {
        headers,
      });

      return response.data;
    } catch (error) {
      console.error('getBorrowLendPositionQuery - ERROR!', error.response?.data || error.message);
      return null;
    }
  }

  async borrowLendExecute(symbol, side, quantity) {
    const timestamp = Date.now();

    if (!symbol) {
      console.error('symbol required');
      return null;
    }

    if (!side) {
      console.error('side required');
      return null;
    }

    if (!quantity) {
      console.error('quantity required');
      return null;
    }

    const body = {
      symbol,   //symbol token "BTC" "ETH" "SOL"
      side,     // "Borrow" ou "Lend"
      quantity, // string, exemplo: "0.01"
    };

    const headers = auth({
      instruction: 'borrowLendExecute',
      timestamp,
      params: body,
    });

    try {
      const response = await axios.post(`${process.env.API_URL}/api/v1/borrowLend`, body, {
        headers,
      });

      return response.data;
    } catch (error) {
      console.error('borrowLendExecute - ERROR!', error.response?.data || error.message);
      return null;
    }
  }

}

export default new BorrowLend();
