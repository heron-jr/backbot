import LighterAuthentication from './Authentication.js';
import ColorLogger from '../../Utils/ColorLogger.js';

class LighterOrder extends LighterAuthentication {
    constructor(apiKey, secretKey) {
        super(apiKey, secretKey);
        this.logger = new ColorLogger('Lighter Order');
    }

    /**
     * Place a new order
     * @param {Object} orderData - Order data
     * @param {string} orderData.symbol - Market symbol
     * @param {string} orderData.side - Order side (BUY/SELL)
     * @param {string} orderData.type - Order type (MARKET/LIMIT/STOP/STOP_LIMIT)
     * @param {number} orderData.size - Order size
     * @param {number} orderData.price - Order price (for LIMIT orders)
     * @param {number} orderData.stopPrice - Stop price (for STOP orders)
     * @param {boolean} orderData.reduceOnly - Reduce only flag
     * @param {boolean} orderData.postOnly - Post only flag
     * @param {string} orderData.timeInForce - Time in force (GTC/IOC/FOK)
     * @returns {Promise<Object>} Order response
     */
    async placeOrder(orderData) {
        try {
            this.logger.info(`Placing ${orderData.side} ${orderData.type} order for ${orderData.symbol}...`);
            
            const response = await this.makeAuthenticatedRequest('POST', '/v1/orders', orderData);
            
            this.logger.success(`Order placed successfully: ${response.data.orderId}`);
            return response.data;
        } catch (error) {
            this.logger.error(`Error placing order: ${error.message}`);
            throw error;
        }
    }

    /**
     * Cancel an order
     * @param {string} orderId - Order ID
     * @param {string} symbol - Market symbol
     * @returns {Promise<Object>} Cancel response
     */
    async cancelOrder(orderId, symbol) {
        try {
            this.logger.info(`Cancelling order ${orderId} for ${symbol}...`);
            
            const data = { orderId, symbol };
            const response = await this.makeAuthenticatedRequest('DELETE', '/v1/orders', data);
            
            this.logger.success(`Order ${orderId} cancelled successfully`);
            return response.data;
        } catch (error) {
            this.logger.error(`Error cancelling order: ${error.message}`);
            throw error;
        }
    }

    /**
     * Cancel all orders
     * @param {string} symbol - Market symbol (optional)
     * @returns {Promise<Object>} Cancel response
     */
    async cancelAllOrders(symbol = null) {
        try {
            this.logger.info(`Cancelling all orders${symbol ? ` for ${symbol}` : ''}...`);
            
            const data = {};
            if (symbol) data.symbol = symbol;
            
            const response = await this.makeAuthenticatedRequest('DELETE', '/v1/orders/all', data);
            
            this.logger.success('All orders cancelled successfully');
            return response.data;
        } catch (error) {
            this.logger.error(`Error cancelling all orders: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get order by ID
     * @param {string} orderId - Order ID
     * @param {string} symbol - Market symbol
     * @returns {Promise<Object>} Order details
     */
    async getOrder(orderId, symbol) {
        try {
            this.logger.info(`Fetching order ${orderId} for ${symbol}...`);
            
            const params = { orderId, symbol };
            const response = await this.makeAuthenticatedRequest('GET', '/v1/orders', {}, params);
            
            this.logger.success(`Order ${orderId} retrieved`);
            return response.data;
        } catch (error) {
            this.logger.error(`Error fetching order: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get open orders
     * @param {string} symbol - Market symbol (optional)
     * @param {number} limit - Number of orders to fetch (default: 100)
     * @returns {Promise<Array>} Open orders
     */
    async getOpenOrders(symbol = null, limit = 100) {
        try {
            this.logger.info(`Fetching open orders${symbol ? ` for ${symbol}` : ''}...`);
            
            const params = { limit };
            if (symbol) params.symbol = symbol;
            
            const response = await this.makeAuthenticatedRequest('GET', '/v1/orders/open', {}, params);
            
            this.logger.success(`Retrieved ${response.data.length} open orders`);
            return response.data;
        } catch (error) {
            this.logger.error(`Error fetching open orders: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get order history
     * @param {string} symbol - Market symbol (optional)
     * @param {string} startTime - Start time in ISO format (optional)
     * @param {string} endTime - End time in ISO format (optional)
     * @param {number} limit - Number of orders to fetch (default: 100)
     * @returns {Promise<Array>} Order history
     */
    async getOrderHistory(symbol = null, startTime = null, endTime = null, limit = 100) {
        try {
            this.logger.info(`Fetching order history${symbol ? ` for ${symbol}` : ''}...`);
            
            const params = { limit };
            if (symbol) params.symbol = symbol;
            if (startTime) params.startTime = startTime;
            if (endTime) params.endTime = endTime;
            
            const response = await this.makeAuthenticatedRequest('GET', '/v1/orders/history', {}, params);
            
            this.logger.success(`Retrieved ${response.data.length} historical orders`);
            return response.data;
        } catch (error) {
            this.logger.error(`Error fetching order history: ${error.message}`);
            throw error;
        }
    }

    /**
     * Modify an existing order
     * @param {Object} orderData - Order modification data
     * @param {string} orderData.orderId - Order ID
     * @param {string} orderData.symbol - Market symbol
     * @param {number} orderData.price - New price
     * @param {number} orderData.size - New size
     * @returns {Promise<Object>} Modified order
     */
    async modifyOrder(orderData) {
        try {
            this.logger.info(`Modifying order ${orderData.orderId} for ${orderData.symbol}...`);
            
            const response = await this.makeAuthenticatedRequest('PUT', '/v1/orders', orderData);
            
            this.logger.success(`Order ${orderData.orderId} modified successfully`);
            return response.data;
        } catch (error) {
            this.logger.error(`Error modifying order: ${error.message}`);
            throw error;
        }
    }

    /**
     * Place multiple orders (batch)
     * @param {Array} orders - Array of order data
     * @returns {Promise<Array>} Order responses
     */
    async placeBatchOrders(orders) {
        try {
            this.logger.info(`Placing ${orders.length} batch orders...`);
            
            const data = { orders };
            const response = await this.makeAuthenticatedRequest('POST', '/v1/orders/batch', data);
            
            this.logger.success(`Batch orders placed successfully`);
            return response.data;
        } catch (error) {
            this.logger.error(`Error placing batch orders: ${error.message}`);
            throw error;
        }
    }
}

export default LighterOrder; 