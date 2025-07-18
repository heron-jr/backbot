import LighterAuthentication from './Authentication.js';
import ColorLogger from '../../Utils/ColorLogger.js';

class LighterAccount extends LighterAuthentication {
    constructor(apiKey, secretKey) {
        super(apiKey, secretKey);
        this.logger = new ColorLogger('Lighter Account');
    }

    /**
     * Get account balance
     * @returns {Promise<Object>} Account balance
     */
    async getBalance() {
        try {
            this.logger.info('Fetching account balance...');
            
            const response = await this.makeAuthenticatedRequest('GET', '/v1/account/balance');
            
            this.logger.success('Account balance retrieved');
            return response.data;
        } catch (error) {
            this.logger.error(`Error fetching account balance: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get account information
     * @returns {Promise<Object>} Account information
     */
    async getAccountInfo() {
        try {
            this.logger.info('Fetching account information...');
            
            const response = await this.makeAuthenticatedRequest('GET', '/v1/account/info');
            
            this.logger.success('Account information retrieved');
            return response.data;
        } catch (error) {
            this.logger.error(`Error fetching account info: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get account positions
     * @param {string} symbol - Market symbol (optional)
     * @returns {Promise<Array>} Account positions
     */
    async getPositions(symbol = null) {
        try {
            this.logger.info('Fetching account positions...');
            
            const params = {};
            if (symbol) {
                params.symbol = symbol;
            }
            
            const response = await this.makeAuthenticatedRequest('GET', '/v1/account/positions', {}, params);
            
            this.logger.success('Account positions retrieved');
            return response.data;
        } catch (error) {
            this.logger.error(`Error fetching positions: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get account PnL
     * @param {string} symbol - Market symbol (optional)
     * @param {string} startTime - Start time in ISO format (optional)
     * @param {string} endTime - End time in ISO format (optional)
     * @returns {Promise<Object>} PnL data
     */
    async getPnL(symbol = null, startTime = null, endTime = null) {
        try {
            this.logger.info('Fetching account PnL...');
            
            const params = {};
            if (symbol) params.symbol = symbol;
            if (startTime) params.startTime = startTime;
            if (endTime) params.endTime = endTime;
            
            const response = await this.makeAuthenticatedRequest('GET', '/v1/account/pnl', {}, params);
            
            this.logger.success('Account PnL retrieved');
            return response.data;
        } catch (error) {
            this.logger.error(`Error fetching PnL: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get account risk metrics
     * @returns {Promise<Object>} Risk metrics
     */
    async getRiskMetrics() {
        try {
            this.logger.info('Fetching account risk metrics...');
            
            const response = await this.makeAuthenticatedRequest('GET', '/v1/account/risk');
            
            this.logger.success('Risk metrics retrieved');
            return response.data;
        } catch (error) {
            this.logger.error(`Error fetching risk metrics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get account trading limits
     * @returns {Promise<Object>} Trading limits
     */
    async getTradingLimits() {
        try {
            this.logger.info('Fetching trading limits...');
            
            const response = await this.makeAuthenticatedRequest('GET', '/v1/account/limits');
            
            this.logger.success('Trading limits retrieved');
            return response.data;
        } catch (error) {
            this.logger.error(`Error fetching trading limits: ${error.message}`);
            throw error;
        }
    }
}

export default LighterAccount; 