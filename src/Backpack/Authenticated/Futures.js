import axios from 'axios';
import { auth } from './Authentication.js';

class Futures {

  async getOpenPositions() {
      const timestamp = Date.now();
      const headers = auth({
        instruction: 'positionQuery',
        timestamp,
      });
      try {
        const response = await axios.get(`${process.env.API_URL}/api/v1/position`, {
          headers,
        });
        return response.data
      } catch (error) {
        console.error('getOpenPositions - ERROR!', error.response?.data || error.message);
        return null
      }
  }

}

export default new Futures();
