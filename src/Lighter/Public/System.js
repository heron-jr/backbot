import axios from 'axios';
import ColorLogger from '../../Utils/ColorLogger.js';

class LighterSystem {
    constructor() {
        this.baseURL = 'https://api.lighter.xyz';
        this.logger = new ColorLogger('Lighter System');
    }

    /**
     * Get system status and health
     * @returns {Promise<Object>} System status
     */
    async getSystemStatus() {
        try {
            this.logger.info('Fetching Lighter system status...');
            
            const response = await axios.get(`${this.baseURL}/v1/system/status`);
            
            if (response.data && response.data.success) {
                const status = response.data.data;
                this.logger.success('System status retrieved');
                return status;
            } else {
                throw new Error('Invalid response format from Lighter API');
            }
        } catch (error) {
            this.logger.error(`Error fetching system status: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get exchange information
     * @returns {Promise<Object>} Exchange information
     */
    async getExchangeInfo() {
        try {
            this.logger.info('Fetching Lighter exchange information...');
            
            const response = await axios.get(`${this.baseURL}/v1/system/info`);
            
            if (response.data && response.data.success) {
                const info = response.data.data;
                this.logger.success('Exchange information retrieved');
                return info;
            } else {
                throw new Error('Invalid response format from Lighter API');
            }
        } catch (error) {
            this.logger.error(`Error fetching exchange info: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get server time
     * @returns {Promise<Object>} Server time
     */
    async getServerTime() {
        try {
            this.logger.info('Fetching Lighter server time...');
            
            const response = await axios.get(`${this.baseURL}/v1/system/time`);
            
            if (response.data && response.data.success) {
                const time = response.data.data;
                this.logger.success(`Server time: ${time.serverTime}`);
                return time;
            } else {
                throw new Error('Invalid response format from Lighter API');
            }
        } catch (error) {
            this.logger.error(`Error fetching server time: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get trading rules and limits
     * @returns {Promise<Object>} Trading rules
     */
    async getTradingRules() {
        try {
            this.logger.info('Fetching Lighter trading rules...');
            
            const response = await axios.get(`${this.baseURL}/v1/system/rules`);
            
            if (response.data && response.data.success) {
                const rules = response.data.data;
                this.logger.success('Trading rules retrieved');
                return rules;
            } else {
                throw new Error('Invalid response format from Lighter API');
            }
        } catch (error) {
            this.logger.error(`Error fetching trading rules: ${error.message}`);
            throw error;
        }
    }
}

export default LighterSystem; 