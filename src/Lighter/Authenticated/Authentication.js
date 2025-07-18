import crypto from 'crypto';
import axios from 'axios';
import ColorLogger from '../../Utils/ColorLogger.js';

class LighterAuthentication {
    constructor(apiKey, secretKey) {
        this.apiKey = apiKey;
        this.secretKey = secretKey;
        this.baseURL = 'https://api.lighter.xyz';
        this.logger = new ColorLogger('Lighter Auth');
    }

    /**
     * Generate signature for authenticated requests
     * @param {string} method - HTTP method
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Request parameters
     * @param {number} timestamp - Request timestamp
     * @returns {string} Generated signature
     */
    generateSignature(method, endpoint, params = {}, timestamp) {
        try {
            // Create query string from parameters
            const queryString = Object.keys(params)
                .sort()
                .map(key => `${key}=${params[key]}`)
                .join('&');

            // Create string to sign
            const stringToSign = `${method}${endpoint}${queryString}${timestamp}`;
            
            // Generate HMAC signature
            const signature = crypto
                .createHmac('sha256', this.secretKey)
                .update(stringToSign)
                .digest('hex');

            return signature;
        } catch (error) {
            this.logger.error(`Error generating signature: ${error.message}`);
            throw error;
        }
    }

    /**
     * Make authenticated request
     * @param {string} method - HTTP method
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Request data
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} API response
     */
    async makeAuthenticatedRequest(method, endpoint, data = {}, params = {}) {
        try {
            const timestamp = Date.now();
            const signature = this.generateSignature(method, endpoint, params, timestamp);

            const config = {
                method: method.toLowerCase(),
                url: `${this.baseURL}${endpoint}`,
                headers: {
                    'X-API-Key': this.apiKey,
                    'X-Signature': signature,
                    'X-Timestamp': timestamp,
                    'Content-Type': 'application/json'
                }
            };

            if (Object.keys(params).length > 0) {
                config.params = params;
            }

            if (Object.keys(data).length > 0) {
                config.data = data;
            }

            const response = await axios(config);
            
            if (response.data && response.data.success) {
                return response.data;
            } else {
                throw new Error(response.data?.message || 'Request failed');
            }
        } catch (error) {
            this.logger.error(`Authenticated request failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Test API key validity
     * @returns {Promise<boolean>} True if valid
     */
    async testApiKey() {
        try {
            this.logger.info('Testing Lighter API key...');
            
            const response = await this.makeAuthenticatedRequest('GET', '/v1/account/balance');
            
            this.logger.success('API key is valid');
            return true;
        } catch (error) {
            this.logger.error(`API key test failed: ${error.message}`);
            return false;
        }
    }

    /**
     * Get API key permissions
     * @returns {Promise<Object>} API key permissions
     */
    async getApiKeyPermissions() {
        try {
            this.logger.info('Fetching API key permissions...');
            
            const response = await this.makeAuthenticatedRequest('GET', '/v1/account/permissions');
            
            this.logger.success('API key permissions retrieved');
            return response.data;
        } catch (error) {
            this.logger.error(`Error fetching API key permissions: ${error.message}`);
            throw error;
        }
    }
}

export default LighterAuthentication; 