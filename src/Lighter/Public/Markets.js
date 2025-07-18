import axios from 'axios';
import ColorLogger from '../../Utils/ColorLogger.js';

class LighterMarkets {
    constructor() {
        this.baseURL = 'https://api.lighter.xyz';
        this.logger = new ColorLogger('Lighter Markets');
    }

    /**
     * Get all available markets
     * @returns {Promise<Array>} Array of market data
     */
    async getMarkets() {
        try {
            this.logger.info('Fetching Lighter markets...');
            
            // Lighter API endpoint for markets
            const response = await axios.get(`${this.baseURL}/v1/markets`);
            
            if (response.data && response.data.success) {
                const markets = response.data.data || [];
                this.logger.success(`Found ${markets.length} markets on Lighter`);
                return markets;
            } else {
                throw new Error('Invalid response format from Lighter API');
            }
        } catch (error) {
            this.logger.error(`Error fetching Lighter markets: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get market details by symbol
     * @param {string} symbol - Market symbol (e.g., 'BTC-PERP')
     * @returns {Promise<Object>} Market details
     */
    async getMarket(symbol) {
        try {
            this.logger.info(`Fetching market details for ${symbol}...`);
            
            const response = await axios.get(`${this.baseURL}/v1/markets/${symbol}`);
            
            if (response.data && response.data.success) {
                const market = response.data.data;
                this.logger.success(`Market details retrieved for ${symbol}`);
                return market;
            } else {
                throw new Error(`Market ${symbol} not found`);
            }
        } catch (error) {
            this.logger.error(`Error fetching market ${symbol}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get market ticker information
     * @param {string} symbol - Market symbol
     * @returns {Promise<Object>} Ticker data
     */
    async getTicker(symbol) {
        try {
            this.logger.info(`Fetching ticker for ${symbol}...`);
            
            const response = await axios.get(`${this.baseURL}/v1/markets/${symbol}/ticker`);
            
            if (response.data && response.data.success) {
                const ticker = response.data.data;
                this.logger.success(`Ticker retrieved for ${symbol}`);
                return ticker;
            } else {
                throw new Error(`Ticker for ${symbol} not found`);
            }
        } catch (error) {
            this.logger.error(`Error fetching ticker for ${symbol}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get order book for a market
     * @param {string} symbol - Market symbol
     * @param {number} depth - Order book depth (default: 20)
     * @returns {Promise<Object>} Order book data
     */
    async getOrderBook(symbol, depth = 20) {
        try {
            this.logger.info(`Fetching order book for ${symbol} (depth: ${depth})...`);
            
            const response = await axios.get(`${this.baseURL}/v1/markets/${symbol}/orderbook`, {
                params: { depth }
            });
            
            if (response.data && response.data.success) {
                const orderbook = response.data.data;
                this.logger.success(`Order book retrieved for ${symbol}`);
                return orderbook;
            } else {
                throw new Error(`Order book for ${symbol} not found`);
            }
        } catch (error) {
            this.logger.error(`Error fetching order book for ${symbol}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get recent trades for a market
     * @param {string} symbol - Market symbol
     * @param {number} limit - Number of trades to fetch (default: 100)
     * @returns {Promise<Array>} Recent trades
     */
    async getRecentTrades(symbol, limit = 100) {
        try {
            this.logger.info(`Fetching recent trades for ${symbol} (limit: ${limit})...`);
            
            const response = await axios.get(`${this.baseURL}/v1/markets/${symbol}/trades`, {
                params: { limit }
            });
            
            if (response.data && response.data.success) {
                const trades = response.data.data || [];
                this.logger.success(`Retrieved ${trades.length} recent trades for ${symbol}`);
                return trades;
            } else {
                throw new Error(`Trades for ${symbol} not found`);
            }
        } catch (error) {
            this.logger.error(`Error fetching trades for ${symbol}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get market statistics
     * @param {string} symbol - Market symbol
     * @returns {Promise<Object>} Market statistics
     */
    async getMarketStats(symbol) {
        try {
            this.logger.info(`Fetching market stats for ${symbol}...`);
            
            const response = await axios.get(`${this.baseURL}/v1/markets/${symbol}/stats`);
            
            if (response.data && response.data.success) {
                const stats = response.data.data;
                this.logger.success(`Market stats retrieved for ${symbol}`);
                return stats;
            } else {
                throw new Error(`Stats for ${symbol} not found`);
            }
        } catch (error) {
            this.logger.error(`Error fetching market stats for ${symbol}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get funding rate for perpetual markets
     * @param {string} symbol - Market symbol
     * @returns {Promise<Object>} Funding rate data
     */
    async getFundingRate(symbol) {
        try {
            this.logger.info(`Fetching funding rate for ${symbol}...`);
            
            const response = await axios.get(`${this.baseURL}/v1/markets/${symbol}/funding`);
            
            if (response.data && response.data.success) {
                const funding = response.data.data;
                this.logger.success(`Funding rate retrieved for ${symbol}`);
                return funding;
            } else {
                throw new Error(`Funding rate for ${symbol} not found`);
            }
        } catch (error) {
            this.logger.error(`Error fetching funding rate for ${symbol}: ${error.message}`);
            throw error;
        }
    }
}

export default LighterMarkets; 