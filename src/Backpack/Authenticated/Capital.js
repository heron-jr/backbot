import axios from 'axios';
import { auth } from './Authentication.js';

class Capital {

  async getBalances() {
    const timestamp = Date.now();

    const headers = auth({
      instruction: 'balanceQuery',
      timestamp,
    });

    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/capital`, {
        headers,
      });

      return response.data
    } catch (error) {
      console.error('getBalances - ERROR!', error.response?.data || error.message);
      return null
    }
  }

  async getCollateral(strategy = null) {
    const timestamp = Date.now();

    const headers = auth({
      instruction: 'collateralQuery',
      timestamp,
      params: {}, // Sem parâmetros nesse caso
      strategy: strategy
    });

    try {
      const response = await axios.get(`${process.env.API_URL}/api/v1/capital/collateral`, {
        headers,
      });

      return response.data
    } catch (error) {
      console.error('getCollateral - ERROR!', error.response?.data || error.message);
      return null
    }
  }

  async getDeposits(
  from = Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days
  to = Date.now(),                             // now
  limit = 100,
  offset = 0
  ) {
  const timestamp = Date.now();

  const params = { from, to, limit, offset };

  const headers = auth({
    instruction: 'depositQueryAll',
    timestamp,
    params
  });

  try {
    const response = await axios.get(`${process.env.API_URL}/wapi/v1/capital/deposits`, {
      headers,
      params
    });

    return response.data;
  } catch (error) {
    console.error('getDeposits - ERROR!', error.response?.data || error.message);
    return null;
  }
}

  // blockchain: "Arbitrum" "Base" "Berachain" "Bitcoin" "BitcoinCash" "Bsc" "Cardano" "Dogecoin" "EqualsMoney" "Ethereum" "Hyperliquid" "Litecoin" "Polygon" "Sui" "Solana" "Story" "XRP"
  async getDepositAddress(blockchain) {
    const timestamp = Date.now();

     if (!blockchain) {
      console.error('blockchain required');
      return null;
    }

    const params = {blockchain}

    const headers = auth({
      instruction: 'depositAddressQuery',
      timestamp,
      params, 
    });

    try {
      const response = await axios.get(`${process.env.API_URL}/wapi/v1/capital/deposit/address`, {
        headers,
        params: params
      });

      return response.data
    } catch (error) {
      console.error('getDepositAddress - ERROR!', error.response?.data || error.message);
      return null
    }
  }

  async getWithdrawals(
  from = Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days
  to = Date.now(),                             // agora
  limit = 100,
  offset = 0
  ) {
  const timestamp = Date.now();

  const params = { from, to, limit, offset };

  const headers = auth({
    instruction: 'withdrawalQueryAll',
    timestamp,
    params
  });

  try {
    const response = await axios.get(`${process.env.API_URL}/wapi/v1/capital/withdrawals`, {
      headers,
      params
    });

    return response.data;
  } catch (error) {
    console.error('getWithdrawals - ERROR!', error.response?.data || error.message);
    return null;
  }
}

}

export default new Capital();
