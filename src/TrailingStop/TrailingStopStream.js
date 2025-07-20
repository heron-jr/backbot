import WebSocket from 'ws';
import dotenv from 'dotenv';
import { auth } from '../Backpack/Authenticated/Authentication.js';
import OrderController from '../Controllers/OrderController.js';
import CacheController from '../Controllers/CacheController.js';
import StopEvaluator from './StopEvaluator.js'; 
import Order from '../Backpack/Authenticated/Order.js';
import Futures from '../Backpack/Authenticated/Futures.js';
const Cache = new CacheController();
dotenv.config();

class TrailingStopStream {

  constructor() {
    this.VOLUME_ORDER = Number(process.env.VOLUME_ORDER);
    this.MAX_PERCENT_LOSS = Number(String(process.env.MAX_PERCENT_LOSS).replace("%", ""));
    this.wsPrivate = null;
    this.wsPublic = null;
    this.positions = {};      
    this.activeStops = {};     
    this.subscribedSymbols = new Set(); 
  }

  async updatePositions() {
    const positions = await Futures.getOpenPositions()
    if(positions){
      this.positions = {}
      const account = await Cache.get();

      for (const position of positions) {
          const symbol = position.symbol
          const markPrice =  Number(position.markPrice);
          const entryPrice =  Number(position.entryPrice);
          const notional = Number(position.netExposureNotional)
          const fee = Math.abs(notional * account.fee) * 2;
          const pnlRealized = Number(position.pnlRealized);
          const pnlUnrealized = Number(position.pnlUnrealized);
          const pnl = (pnlRealized + pnlUnrealized) - fee;
          const qty = Number(position.netExposureQuantity)
          const isLong = parseFloat(position.netQuantity) > 0;

          this.positions[symbol] = {
            symbol,
            markPrice,
            entryPrice,
            pnl,
            qty,
            notional,
            isLong
          };
      }
      
      this.syncMarkPriceSubscriptions();
    }
  }

  async updateStops(symbol) {
    const orders = await Order.getOpenOrders(symbol)
    this.activeStops[symbol] = orders;
  }
  
  async onPositionUpdate(data) {
    const symbol = data.s;
    const account = await Cache.get();

    const markPrice = Number(data.M);
    const entryPrice = Number(data.B);
    const pnlRealized = Number(data.p);
    const pnlUnrealized = Number(data.P);
    const notional = Number(data.n);
    const qty = Number(data.q);
    const isLong = qty > 0

    const fee = Math.abs(notional * account.fee) * 2;
    const pnl = (pnlRealized + pnlUnrealized) - fee;

    this.positions[symbol] = {
      symbol,
      markPrice,
      entryPrice,
      pnl,
      qty,
      notional,
      isLong
    };

    await this.updateStops(symbol)
    this.syncMarkPriceSubscriptions();

  }

  async onMarkPriceUpdate(symbol, markPrice) {

    const position = this.positions[symbol];

    if(position){
    const orders = await Order.getOpenOrders(symbol)
    const account = await Cache.get()

    const evaluator = new StopEvaluator({
      symbol,
      markPrice,
      orders,
      position,
      account
    });

    const {toCreate, toDelete, toForce} = evaluator.evaluate();

    for (const row of toForce) {
      const positions = await Futures.getOpenPositions()
      const position = positions.find((el) => {return el.symbol === row.symbol})
      if(position){
        await OrderController.forceClose(position)
      }
    }

    for (const row of toDelete) {
      await Order.cancelOpenOrder(row.symbol, row.id)
    }

    for (const row of toCreate) {
      await OrderController.createLimitTriggerStop(row.symbol, row.side, row.price, row.quantity, account, markPrice);
    }

    }
  }

  syncMarkPriceSubscriptions() {
  if (!this.wsPublic || this.wsPublic.readyState !== WebSocket.OPEN) return;

  const openSymbols = Object.keys(this.positions); // símbolos com posições abertas

  if (openSymbols.length === 0) return;

  // Verifica quais símbolos devem ser desinscritos
  const symbolsToUnsubscribe = [...this.subscribedSymbols].filter(symbol => !openSymbols.includes(symbol));
  const symbolsToSubscribe = openSymbols.filter(symbol => !this.subscribedSymbols.has(symbol));

  // Atualiza o Set com os novos símbolos válidos
  for (const symbol of symbolsToUnsubscribe) {
    this.subscribedSymbols.delete(symbol);
  }

  for (const symbol of symbolsToSubscribe) {
    this.subscribedSymbols.add(symbol);
  }

  // Envia UNSUBSCRIBE para símbolos inválidos
  if (symbolsToUnsubscribe.length > 0) {
    const payload = {
      method: 'UNSUBSCRIBE',
      params: symbolsToUnsubscribe.map(s => `markPrice.${s}`)
    };
    this.wsPublic.send(JSON.stringify(payload));
  }

  // Envia SUBSCRIBE para novos símbolos
  if (symbolsToSubscribe.length > 0) {
    const payload = {
      method: 'SUBSCRIBE',
      params: symbolsToSubscribe.map(s => `markPrice.${s}`)
    };
    this.wsPublic.send(JSON.stringify(payload));
  }
  }

  connectPrivate() {
    this.wsPrivate = new WebSocket('wss://ws.backpack.exchange');

    this.wsPrivate.on('open', () => {
      console.log('✅ WebSocket privado conectado');

      const timestamp = Date.now();
      const window = 10000;
      const instruction = 'subscribe';
      const params = {};
      const headers = auth({ instruction, params, timestamp, window });

      const payload = {
        method: 'SUBSCRIBE',
        params:  ['account.positionUpdate', 'account.orderUpdate'],
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

        if (parsed.stream === 'account.positionUpdate') {
          await this.onPositionUpdate(parsed.data);
        }

        if (parsed.stream === 'account.orderUpdate') {

            if (["orderCancelled", "orderExpired", "triggerFailed"].includes(parsed.data.e)){
              await this.updatePositions()
              await this.updateStops(parsed.data.s)
            } 

            if(["orderFill", "orderAccepted", "triggerPlaced", "orderAccepted"].includes(parsed.data.e)){
              await this.updatePositions()
            }
        }

      } catch (err) {
        console.error('❌ Erro ao processar posição:', err);
      }
    });

    this.wsPrivate.on('close', () => {
      console.log('🔌 WebSocket privado fechado. Reconectando...');
      reconectPrivate()
    });

    this.wsPrivate.on('error', (err) => {
      console.error('❌ Erro no WebSocket privado:', err);
      reconectPrivate()
    });
  }

  connectPublic() {
    this.wsPublic = new WebSocket('wss://ws.backpack.exchange');

    this.wsPublic.on('open', () => {
      console.log('✅ WebSocket público conectado');
      this.syncMarkPriceSubscriptions();
    });

    this.wsPublic.on('message', async (raw) => {
      try {
        const parsed = JSON.parse(raw);
        const match = parsed.stream?.match(/^markPrice\.(.+)$/);
        if (match) {
          const symbol = match[1];
          const markPrice = Number(parsed.data.p);
          await this.onMarkPriceUpdate(symbol, markPrice);
        }
      } catch (err) {
        console.error('❌ Erro no markPrice:', err);
      }
    });

    this.wsPublic.on('close', () => {
      console.log('🔌 WebSocket público fechado. Reconectando...');
      reconectPublic()
    });

    this.wsPublic.on('error', (err) => {
      console.error('❌ Erro no WebSocket público:', err);
      reconectPublic()
    });
  }

  reconectPrivate() {
    this.wsPrivate?.terminate();
    this.wsPrivate = null;
    setTimeout(() => this.connectPrivate(), 3000);
  }

  reconectPublic() {
    this.wsPublic?.terminate();
    this.wsPublic = null;
    setTimeout(() => this.connectPublic(), 3000);
  }

  start() {
    this.connectPrivate();
    this.connectPublic();

    setInterval(() => {
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

}

export default new TrailingStopStream();
