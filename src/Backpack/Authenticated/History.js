import axios from 'axios';
import { auth } from './Authentication.js';

class History {

  async getBorrowHistory(symbol, type, limit, offset, sortDirection, positionId, sources) {
    const timestamp = Date.now();

     const params = {};
      if (symbol) params.symbol = symbol;
      if (type) params.type = type;
      if (limit) params.limit = limit;
      if (offset) params.offset = offset;
      if (sortDirection) params.sortDirection = sortDirection;
      if (positionId) params.positionId = positionId;
      if (sources) params.sources = sources;

    const headers = auth({
      instruction: 'borrowHistoryQueryAll',
      timestamp,
      params: params,
    });

    try {
      const response = await axios.get(`${process.env.API_URL}/wapi/v1/history/borrowLend`, {
        headers,
        params
      });

      return response.data
    } catch (error) {
      console.error('getBorrowHistory - ERROR!', error.response?.data || error.message);
      return null
    }
  }

  async getInterestHistory(symbol, type, limit, offset, sortDirection, positionId, sources) {
    const timestamp = Date.now();

     const params = {};
      if (symbol) params.symbol = symbol;
      if (type) params.type = type;
      if (limit) params.limit = limit;
      if (offset) params.offset = offset;
      if (sortDirection) params.sortDirection = sortDirection;
      if (positionId) params.positionId = positionId;
      if (sources) params.sources = sources;

    const headers = auth({
      instruction: 'interestHistoryQueryAll',
      timestamp,
      params: params, 
    });

    try {
      const response = await axios.get(`${process.env.API_URL}/wapi/v1/history/interest`, {
        headers,
        params
      });

      return response.data
    } catch (error) {
      console.error('getInterestHistory - ERROR!', error.response?.data || error.message);
      return null
    }
  }

  async getBorrowPositionHistory(symbol, side, state, limit, offset, sortDirection) {
    const timestamp = Date.now();

    const params = {};
    if (symbol) params.symbol = symbol;
    if (side) params.type = type;
    if (state) params.state = state;
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;
    if (sortDirection) params.sortDirection = sortDirection;

    const headers = auth({
      instruction: 'borrowPositionHistoryQueryAll',
      timestamp,
      params: params, 
    });

    try {
      const response = await axios.get(`${process.env.API_URL}/wapi/v1/history/borrowLend/positions`, {
        headers,
        params
      });

      return response.data
    } catch (error) {
      console.error('getBorrowPositionHistory - ERROR!', error.response?.data || error.message);
      return null
    }
  }

  async getFillHistory(symbol, orderId, from, to, limit, offset, fillType, marketType, sortDirection) {
  const timestamp = Date.now();

  const params = {};
  if (orderId) params.orderId = orderId;
  if (from) params.from = from;
  if (to) params.to = to;
  if (symbol) params.symbol = symbol;
  if (limit) params.limit = limit;
  if (offset) params.offset = offset;
  if (fillType) params.fillType = fillType;
  if (marketType) params.marketType = marketType; // array if multi values
  if (sortDirection) params.sortDirection = sortDirection;

  const headers = auth({
    instruction: 'fillHistoryQueryAll',
    timestamp,
    params,
  });

  try {
    const response = await axios.get(`${process.env.API_URL}/wapi/v1/history/fills`, {
      headers,
      params,
    });

    return response.data;
  } catch (error) {
    console.error('getFillHistory - ERROR!', error.response?.data || error.message);
    return null;
  }
  }

  async getFundingPayments(symbol, limit, offset, sortDirection) {
    const timestamp = Date.now();

    const params = {};
    if (symbol) params.symbol = symbol;
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;
    if (sortDirection) params.sortDirection = sortDirection;

    const headers = auth({
      instruction: 'fundingHistoryQueryAll',
      timestamp,
      params,
    });

    try {
      const response = await axios.get(`${process.env.API_URL}/wapi/v1/history/funding`, {
        headers,
        params,
      });

      return response.data;
    } catch (error) {
      console.error('getFundingPayments - ERROR!', error.response?.data || error.message);
      return null;
    }
  }

  async getOrderHistory(orderId, symbol, limit, offset, marketType, sortDirection) {
    const timestamp = Date.now();

    const params = {};
    if (orderId) params.orderId = orderId;
    if (symbol) params.symbol = symbol;
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;
    if (marketType) params.marketType = marketType;
    if (sortDirection) params.sortDirection = sortDirection;

    const headers = auth({
      instruction: 'orderHistoryQueryAll',
      timestamp,
      params,
    });

    try {
      const response = await axios.get(`${process.env.API_URL}/wapi/v1/history/orders`, {
        headers,
        params,
      });

      return response.data;
    } catch (error) {
      console.error('getOrderHistory - ERROR!', error.response?.data || error.message);
      return null;
    }
  }

  async getProfitAndLossHistory(subaccountId, symbol, limit, offset, sortDirection) {
    const timestamp = Date.now();

    const params = {};
    if (subaccountId) params.subaccountId = subaccountId;
    if (symbol) params.symbol = symbol;
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;
    if (sortDirection) params.sortDirection = sortDirection;

    const headers = auth({
      instruction: 'pnlHistoryQueryAll',
      timestamp,
      params,
    });

    try {
      const response = await axios.get(`${process.env.API_URL}/wapi/v1/history/pnl`, {
        headers,
        params,
      });

      return response.data;
    } catch (error) {
      console.error('getProfitAndLossHistory - ERROR!', error.response?.data || error.message);
      return null;
    }
  }

  //source: "BackstopLiquidation" "CulledBorrowInterest" "CulledRealizePnl" "CulledRealizePnlBookUtilization" "FundingPayment" "RealizePnl" "TradingFees" "TradingFeesSystem"
  async getSettlementHistory(limit, offset, source, sortDirection) {
    const timestamp = Date.now();

    const params = {};
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;
    if (source) params.source = source;
    if (sortDirection) params.sortDirection = sortDirection;

    const headers = auth({
      instruction: 'settlementHistoryQueryAll',
      timestamp,
      params,
    });

    try {
      const response = await axios.get(`${process.env.API_URL}/wapi/v1/history/settlement`, {
        headers,
        params,
      });

      return response.data;
    } catch (error) {
      console.error('getSettlementHistory - ERROR!', error.response?.data || error.message);
      return null;
    }
  }

}

export default new History();
