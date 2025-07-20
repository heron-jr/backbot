import dotenv from 'dotenv';
import OrderController from '../Controllers/OrderController.js';
import AccountController from '../Controllers/AccountController.js';
import Order from '../Backpack/Authenticated/Order.js';
import Markets from '../Backpack/Public/Markets.js'
import CacheController from '../Controllers/CacheController.js';
import Futures from '../Backpack/Authenticated/Futures.js';
import WebSocket from 'ws';
import { auth } from '../Backpack/Authenticated/Authentication.js';

const Cache = new CacheController();
dotenv.config();

class Grid {

  constructor() {
    this.symbol = process.env.GRID_MARKET;
    this.lowerPrice = parseFloat(process.env.LOWER_PRICE);
    this.upperPrice = parseFloat(process.env.UPPER_PRICE);
    this.numGrids = parseInt(process.env.NUMBER_OF_GRIDS);
    this.upperClose = parseInt(process.env.UPPER_FORCE_CLOSE);
    this.lowerClose = parseInt(process.env.LOWER_FORCE_CLOSE);
    this.gridPnl = parseInt(process.env.GRID_PNL);
    this.gridStep = (this.upperPrice - this.lowerPrice) / this.numGrids;
    this.orders = []; 
    this.wsPrivate = null;
    this.wsPublic = null; 
  }

  generateGridOrders(lastPrice) {
    this.orders = [];
    for (let i = 0; i < this.numGrids; i++) {
      const price = Number((this.lowerPrice + i * this.gridStep).toFixed(6));
      const side = price < lastPrice ? 'Bid' : 'Ask';
      this.orders.push({ price, side, clientId: i });
    }
  }

  async cancelAllOrders() {
    try {
      await Order.cancelOpenOrders(this.symbol);
      console.log(`🧹 Cancelled existing orders for ${this.symbol}`);
    } catch (err) {
      console.error('❌ Error while cancelling orders:', err.message);
    }
  }

  async placeGridOrders() {
    const account = await Cache.get()

    for (const { price, side, clientId } of this.orders) {

    const quantityPerGrid = (account.capitalAvailable / this.numGrids) / price

      try {
        await OrderController.createLimitOrderGrid(
          this.symbol,
          side,
          price,
          quantityPerGrid,
          account,
          clientId
        );
        console.log(`📌 ${side} @ ${price} [${clientId}]`);
      } catch (err) {
        console.error(`❌ Failed to create order ${price}:`, err.message);
      }
    }
  }

  async run() {
    const [markPriceData] = await Markets.getAllMarkPrices(this.symbol);
    const lastPrice = Number(markPriceData.markPrice);
    this.generateGridOrders(lastPrice);
    await this.cancelAllOrders();
    await this.placeGridOrders();
    this.connectPrivate();
    this.connectPublic();

    setInterval(() => {
      console.log("Runing private", !this.wsPrivate || this.wsPrivate.readyState !== WebSocket.OPEN )
      console.log("Runing public", !this.wsPublic || this.wsPublic.readyState !== WebSocket.OPEN )
          if (!this.wsPrivate || this.wsPrivate.readyState !== WebSocket.OPEN) {
            console.warn('⚠️ wsPrivate inativo. Reconectando...');
            this.connectPrivate();
          }
    
          if (!this.wsPublic || this.wsPublic.readyState !== WebSocket.OPEN) {
            console.warn('⚠️ wsPublic inativo. Reconectando...');
            this.connectPublic();
          }
      }, 30_000); 
  }

  async handleOrderFill() {

  // 1. Pega o markPrice atual
  const [markPriceData] = await Markets.getAllMarkPrices(this.symbol);
  const lastPrice = Number(markPriceData.markPrice);
  const account = await Cache.get();

  // 2. Verifica todas as ordens planejadas
  for (const order of this.orders) {
    const exists = await Order.getOpenOrder(this.symbol, null, order.clientId);

    if (!exists) {
      const side = order.price < lastPrice ? 'Bid' : 'Ask';
      const quantity = (account.capitalAvailable / this.numGrids) / order.price;

      try {
        await OrderController.createLimitOrderGrid(
          this.symbol,
          side,
          order.price,
          quantity,
          account,
          order.clientId
        );
        console.log(`🔁 Order recreated ${side} @ ${order.price} [${order.clientId}]`);
      } catch (err) {
        console.error(`❌ Error while recreating order [${order.clientId}]:`, err.message);
      }
    }
  }
}

  async forceClose(symbol) {
      const positions = await Futures.getOpenPositions();
      const position = positions.find((el) => el.symbol === symbol);

      if(position){

        const markPrice = Number(position.markPrice)
        const netExposureNotional = Number(position.netExposureNotional)
        const account = await Cache.get()
        const closeFee = netExposureNotional * Number(account.makerFee)
        const openFee = netExposureNotional * Number(account.takerFee)
        const totalFee = closeFee + openFee
        const pnl = (Number(position.pnlRealized) + Number(position.pnlUnrealized)) - totalFee
        if (markPrice >= this.upperClose || markPrice <= this.lowerClose || this.gridPnl <= pnl) {
          await OrderController.forceClose(position);
          console.log(`🔒 Position forced to close ${markPrice}`);
          this.run()
        }

      }

   }

  connectPrivate() {
    this.wsPrivate = new WebSocket('wss://ws.backpack.exchange');

    this.wsPrivate.on('open', () => {
      console.log('✅ Private WebSocket connected [Grid Mode]');
      const timestamp = Date.now();
      const window = 10000;
      const instruction = 'subscribe';
      const params = {};
      const headers = auth({ instruction, params, timestamp, window });

      const payload = {
        method: 'SUBSCRIBE',
        params: ['account.positionUpdate', 'account.orderUpdate'],
        signature: [
          headers['X-API-Key'],
          headers['X-Signature'],
          headers['X-Timestamp'],
          headers['X-Window']
        ]
      };

      this.wsPrivate.send(JSON.stringify(payload));
    });

    this.wsPrivate.on('message', async (raw) => {
      try {
        const parsed = JSON.parse(raw);
      console.log("parsed.stream", parsed.stream)
        if (parsed.stream === 'account.positionUpdate') {
          await this.handleOrderFill(parsed.data);
        }

        if (parsed.stream === 'account.orderUpdate') {
          const event = parsed.data;
          if (event.e === 'orderFill' || event.e === 'orderCancel') {
            await this.handleOrderFill(parsed.data);
          }
        }
        
      } catch (err) {
        console.error('❌ Error processing order:', err.message);
      }
    });

    this.wsPrivate.on('close', () => {
      console.warn('🔌 Private WebSocket disconnected. Reconnecting...');
      setTimeout(() => this.connectPrivate(), 3000);
    });

    this.wsPrivate.on('error', (err) => {
      console.error('❌ Error on private WebSocket:', err.message);
    });
  }

  connectPublic() {
    this.wsPublic = new WebSocket('wss://ws.backpack.exchange');

    this.wsPublic.on('open', () => {
      console.log('🌐 Public WebSocket connected [Grid Mode]');
      const payload = {
        method: 'SUBSCRIBE',
        params: [`markPrice.${this.symbol}`],
      };
      this.wsPublic.send(JSON.stringify(payload));
    });

    this.wsPublic.on('message', async (raw) => {
      try {
        const parsed = JSON.parse(raw);

        if (parsed.stream === `markPrice.${this.symbol}`) {
          await this.forceClose(this.symbol)
        }
      } catch (err) {
        console.error('❌ Erro no WebSocket público:', err.message);
      }
    });

    this.wsPublic.on('close', () => {
      console.warn('🔌 Public WebSocket disconnected. Reconnecting...');
      setTimeout(() => this.connectPublic(), 3000);
    });

    this.wsPublic.on('error', (err) => {
      console.error('❌ Error on public WebSocket:', err.message);
    });
  }

}

export default new Grid();


