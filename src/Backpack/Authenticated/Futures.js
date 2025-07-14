import axios from 'axios';
import { auth } from './Authentication.js';

class Futures {

  async getOpenPositions() {
      const timestamp = Date.now();
      
      try {
        const headers = auth({
          instruction: 'positionQuery',
          timestamp,
        });
        
        const response = await axios.get(`${process.env.API_URL}/api/v1/position`, {
          headers,
          timeout: 15000, // Aumentado para 15 segundos
        });
        
        return response.data;
      } catch (error) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          console.warn('⚠️ getOpenPositions - Timeout, tentando novamente em 2s...');
          // Retry após 2 segundos
          await new Promise(resolve => setTimeout(resolve, 2000));
          try {
            const retryHeaders = auth({
              instruction: 'positionQuery',
              timestamp: Date.now(),
            });
            
            const retryResponse = await axios.get(`${process.env.API_URL}/api/v1/position`, {
              headers: retryHeaders,
              timeout: 20000, // Timeout maior na segunda tentativa
            });
            
            console.log('✅ getOpenPositions - Retry bem-sucedido');
            return retryResponse.data;
          } catch (retryError) {
            console.error('❌ getOpenPositions - Retry falhou:', retryError.response?.data || retryError.message);
            return null;
          }
        } else {
          console.error('❌ getOpenPositions - ERROR!', error.response?.data || error.message);
          return null;
        }
      }
  }

}

export default new Futures();
