import axios from 'axios';

class Assets {

  async getAssets() {
    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/assets`);
      return response.data
    } catch (error) {
      console.error('getAssets - ERROR!', error.response?.data || error.message);
      return null;
    }
  }

  
  async getCollateral() {
    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/collateral`);
      return response.data
    } catch (error) {
      console.error('getCollateral - ERROR!', error.response?.data || error.message);
      return null;
    }
  }


}

export default new Assets();
