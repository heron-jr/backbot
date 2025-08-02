
process.env.ENABLE_TRAILING_STOP = 'true';
process.env.ENABLE_HYBRID_STOP_STRATEGY = 'true';
process.env.INITIAL_STOP_ATR_MULTIPLIER = '2.0';
process.env.TAKE_PROFIT_PARTIAL_ATR_MULTIPLIER = '1.5';
process.env.PARTIAL_PROFIT_PERCENTAGE = '50';
process.env.MAX_OPEN_TRADES = '5';
process.env.MAX_NEGATIVE_PNL_STOP_PCT = '4.0';
process.env.MIN_PROFIT_PERCENTAGE = '0.5';
process.env.ORDER_EXECUTION_TIMEOUT_SECONDS = '12';
process.env.MAX_SLIPPAGE_PCT = '0.2';
process.env.TRAILING_STOP_DISTANCE = '0.5';
process.env.ACCOUNT1_TIME = '5m';
process.env.ACCOUNT2_TIME = '1m';
process.env.TIME = '5m';
process.env.FEE = '0.0004';
process.env.API_KEY = 'test_api_key';
process.env.API_SECRET = 'test_api_secret';
process.env.ACCOUNT1_API_KEY = 'test_account1_api_key';
process.env.ACCOUNT1_API_SECRET = 'test_account1_api_secret';
process.env.ACCOUNT2_API_KEY = 'test_account2_api_key';
process.env.ACCOUNT2_API_SECRET = 'test_account2_api_secret';

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('TEST')) {
    originalConsoleLog(...args);
  }
};

console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('TEST')) {
    originalConsoleWarn(...args);
  }
};

console.error = originalConsoleError; 