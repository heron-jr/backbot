import axios from 'axios';

class System {
  
  async getStatus() {

    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/status`);
      return response.data
    } catch (error) {
      console.error('getStatus - ERROR!', error.response?.data || error.message);
      return null;
    }

  }

  async getPing() {

    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/ping`);
      return response.data
    } catch (error) {
      console.error('getPing - ERROR!', error.response?.data || error.message);
      return null;
    }
    
  }

  async getSystemTime() {

    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/time`);
      return response.data
    } catch (error) {
      console.error('getSystemTime - ERROR!', error.response?.data || error.message);
      return null;
    }
    
  }

}

export default new System();
