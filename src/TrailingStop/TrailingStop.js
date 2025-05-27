import Futures from '../Backpack/Authenticated/Futures.js';
import Order from '../Backpack/Authenticated/Order.js';
import OrderController from '../Controllers/OrderController.js';
import AccountController from '../Controllers/AccountController.js';
import Markets from '../Backpack/Public/Markets.js';
import Utils from '../utils/Utils.js';

class TrailingStop {


  processPosition(position, makerFee) {
    const entryPrice = parseFloat(position.entryPrice);
    const markPrice = parseFloat(position.markPrice);
    const quantity = Math.abs(parseFloat(position.netQuantity));
    const netCost = Math.abs(parseFloat(position.netCost));
    const direction = position.netQuantity > 0 ? 1 : -1;
    const isLong = position.netQuantity > 0;

    const grossProfit = (markPrice - entryPrice) * direction * quantity;
    const openFee = entryPrice * quantity * makerFee;
    const closeFee = Math.abs(grossProfit) * makerFee;
    const fee = openFee + closeFee;

    const netProfit = grossProfit - fee;
    const netProfitPercent = (netProfit / netCost) * 100;

    return {
      userId: position.userId,
      positionId: position.positionId,
      symbol: position.symbol,
      profit: netProfit,
      profitPercentage: netProfitPercent,
      breakEvenPrice: position.breakEvenPrice,
      markPrice,
      inProfit: netProfit > 0,
      quantity,
      volume: quantity * markPrice,
      isLong,
    };
  }

  async processOrders(isLong, symbol) {
    const orders = await Order.getOpenOrders(symbol);
    const sortedOrders = isLong
      ? orders.sort((a, b) => parseFloat(a.triggerPrice) - parseFloat(b.triggerPrice))
      : orders.sort((a, b) => parseFloat(b.triggerPrice) - parseFloat(a.triggerPrice));
    return sortedOrders.map((el) => ({
      id: el.id,
      minutes: Utils.minutesAgo(el.createdAt),
      triggerPrice: parseFloat(el.triggerPrice),
    }));
  }

 updateStopsAuto(stops, config) {
  const marketPrice = Number(config.marketPrice);
  const breakEvenPrice = Number(config.breakEvenPrice ?? marketPrice);
  const side = config.side;
  const candles = config.candles;

  const isLong = side === 'long';
  const format = (value) => Number(value.toFixed(8));
  const ensureMinPrice = (value) => Math.max(0.00000001, value);

  // === 1. Detectar últimos topo/fundo local ===
  const highs = candles.map(c => parseFloat(c.high));
  const lows = candles.map(c => parseFloat(c.low));

  const recentTop = Math.max(...highs.slice(-5));
  const recentBottom = Math.min(...lows.slice(-5));

  const trailingGap = isLong
    ? marketPrice - recentBottom
    : recentTop - marketPrice;

  const tpDistance = trailingGap * 1.5;
  const step = trailingGap * 0.1;

  const updates = [];

  // === 2. Se não tem stops, cria stop + TP curtos ===
  if (!stops || stops.length === 0) {
    const stopPrice = ensureMinPrice(isLong
      ? Math.max(breakEvenPrice, marketPrice - trailingGap)
      : Math.min(breakEvenPrice, marketPrice + trailingGap)
    );

    const tpPrice = ensureMinPrice(isLong
      ? marketPrice + tpDistance
      : marketPrice - tpDistance
    );

    return [
      { id: 'auto-stop', triggerPrice: format(stopPrice) },
      { id: 'auto-take-profit', triggerPrice: format(tpPrice) }
    ];
  }

  // === 3. Se tem 1 stop, adiciona o complementar ===
  if (stops.length === 1) {
    const only = stops[0];
    const isStop = isLong
      ? only.triggerPrice < marketPrice
      : only.triggerPrice > marketPrice;

    const rawTrigger = isStop
      ? (isLong ? marketPrice + tpDistance : marketPrice - tpDistance)
      : (isLong
        ? Math.max(breakEvenPrice, marketPrice - trailingGap)
        : Math.min(breakEvenPrice, marketPrice + trailingGap));

    const triggerPrice = ensureMinPrice(rawTrigger);
    return [{
      id: isStop ? 'auto-take-profit' : 'auto-stop',
      triggerPrice: format(triggerPrice)
    }];
  }

  // === 4. STOP + TP já definidos ===
  const sorted = [...stops].sort((a, b) => a.triggerPrice - b.triggerPrice);
  const stop = isLong ? sorted[0] : sorted[1];
  const tp = isLong ? sorted[1] : sorted[0];

  // Novo stop baseado no mercado
  let desiredStop = isLong
    ? Math.max(breakEvenPrice, marketPrice - trailingGap)
    : Math.min(breakEvenPrice, marketPrice + trailingGap);

  desiredStop = ensureMinPrice(desiredStop);

  const shouldUpdateStop = isLong
    ? desiredStop > stop.triggerPrice && (desiredStop - stop.triggerPrice) >= step
    : desiredStop < stop.triggerPrice && (stop.triggerPrice - desiredStop) >= step;

  if (shouldUpdateStop) {
    updates.push({
      id: stop.id,
      triggerPrice: format(desiredStop)
    });
  }

  // Novo TP
  const desiredTP = ensureMinPrice(isLong
    ? marketPrice + tpDistance
    : marketPrice - tpDistance);

  const shouldUpdateTP = isLong
    ? desiredTP > tp.triggerPrice && (desiredTP - tp.triggerPrice) >= step
    : desiredTP < tp.triggerPrice && (tp.triggerPrice - desiredTP) >= step;

  if (shouldUpdateTP) {
    updates.push({
      id: tp.id,
      triggerPrice: format(desiredTP)
    });
  }

  return updates;
}


  async stopLoss() {
    const { minVolumeDollar, fee } = await AccountController.get();

    try {
      const positions = await Futures.getOpenPositions();

      for (const position of positions) {
        const row = this.processPosition(position, fee);
        const orders = await this.processOrders(row.isLong, position.symbol);

        const closeDueToLowVolume = row.volume <= (minVolumeDollar * 0.1);
        const closeDueToStopBreach = false;

        if (closeDueToStopBreach || closeDueToLowVolume) {
          await OrderController.forceClose(position)
        } else {

          console.log("row.br eakEvenPrice", row.breakEvenPrice)

          const candles = await Markets.getKLines(position.symbol, "5m", 9)

          const newStops = this.updateStopsAuto(orders, {
            marketPrice: row.markPrice,
            breakEvenPrice: row.breakEvenPrice,
            side: row.isLong ? 'long' : 'short',
            candles: candles
          })

          for (const stop of newStops) {

            console.log("stop", stop)
            if (['auto-stop', 'auto-take-profit'].includes(stop.id)) {
              await OrderController.createStopTS({
                symbol: row.symbol,
                price: stop.triggerPrice,
                isLong: row.isLong,
                quantity: row.quantity
              });
            } else {
              const cancelled = await OrderController.cancelStopTS(row.symbol, stop.id);
              if (cancelled) {
                await OrderController.createStopTS({
                symbol: row.symbol,
                price: stop.triggerPrice,
                isLong: row.isLong,
                quantity: row.quantity
              });
              }
            }
          }

          if(newStops.length > 0){
            console.log("newStops discored", newStops, row.symbol, "price", row.markPrice)
          }
         
        }
      }
    } catch (error) {
      console.log(error)
      console.error('stopLoss - Error:', error.response?.data || error.message);
      return null;
    }
  }
}

export default new TrailingStop();
