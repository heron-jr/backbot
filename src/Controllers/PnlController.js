import History from '../Backpack/Authenticated/History.js';
import AccountController from './AccountController.js'

class PnlController {

  async getVolumeMarket(symbol, date) {
    const from = new Date(date).getTime()
    const fills = await this.getFillHistory(from, symbol)
    if(fills) {
      const result = this.summarizeTrades(fills)
      return result
    }
    return null
  }

  getSeasonWeek() {
    const now = new Date();
    const seasonStart = new Date('2025-07-03T00:00:00');

    if (now < seasonStart) {
      return "Dont Start Season 2";
    }

    // Calcula a diferença em milissegundos e converte para dias
    const diffMs = now - seasonStart;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Calcula a semana (semana 1 = dias 0 a 6, semana 2 = dias 7 a 13, etc.)
    const weekNumber = Math.floor(diffDays / 7) + 1;

    if (weekNumber > 10) {
      return "Season 2 End";
    }

    return `Week ${weekNumber} of 10`;
  }

  millisSinceLastWednesday23() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // domingo=0, segunda=1, ..., quarta=3
  const daysSinceWednesday = (dayOfWeek + 7 - 3) % 7;

  // Cria data da última quarta-feira
  const lastWednesday = new Date(now);
  lastWednesday.setDate(now.getDate() - daysSinceWednesday);
  lastWednesday.setHours(23, 0, 0, 0);

  // Se hoje for quarta e ainda não passou das 23h, volta mais 7 dias
  if (dayOfWeek === 3 && now < lastWednesday) {
    lastWednesday.setDate(lastWednesday.getDate() - 7);
  }

  const diff = now - lastWednesday;

  return diff;
  }












  async start(TRADING_STRATEGY) {
    try {
    const week = this.getSeasonWeek()
    const milissegundos = this.millisSinceLastWednesday23()
    const date = Date.now() - (milissegundos); 
    const fills = await this.getFillHistory(date)
    if(fills) {
    const result = this.summarizeTrades(fills)
    const VOLUME_BY_POINT = Number(process.env.VOLUME_BY_POINT)
    const points = parseInt(result.totalVolume / VOLUME_BY_POINT)
    const Account = await AccountController.get()
    console.log("")
    console.log("=========================== Wellcome Backbot v2 🤖  ===========================")
    console.log("")
    console.log(`✨ ${week} ✨`)
    console.log("")
    console.log("💸 Fees", Number(parseFloat(result.totalFee).toFixed(2)))
    console.log("💰 Volume", Number(parseFloat(result.totalVolume).toFixed(0)))
    console.log("👀 Volume by 1 fee dol", result.volumeBylFee ? Number(parseFloat(result.volumeBylFee).toFixed(2)) : 0)
    console.log(`📈 Leverage`,Account.leverage)
    console.log(`🔮 Estimated points`, points)
    console.log(`🎮 Selected strategy ${TRADING_STRATEGY}`)
    console.log("")
    console.log("==================== Powered by https://x.com/heronjr_x =======================")
    console.log("")
    console.log("")
    }


    } catch (error) {
      console.log(error)
    }
  }


  async getFillHistory(from, symbol = null) {
  const to = Date.now();                                  
  const orderId = null;
  const limit = 1000;
  const fillType = null;      
  const marketType = null;   
  const sortDirection = 'Desc';

  let offset = 0;
  let allFills = [];

  while (true) {
    const fills = await History.getFillHistory(
      symbol,
      orderId,
      from,
      to,
      limit,
      offset,
      fillType,
      marketType,
      sortDirection
    );

    if (!fills || fills.length === 0) {
      break;
    }

    allFills.push(...fills);

    if (fills.length < limit) {
      break;
    }

    offset += limit;
  }

  return allFills;
}


  
  async run(hour = 24) {
    try {
      const oneDayAgo = Date.now() - hour * 60 * 60 * 1000;      
      const fills = await this.getFillHistory(oneDayAgo)

      if(fills) {
          const VOLUME_BY_POINT = Number(process.env.VOLUME_BY_POINT)
          const result = this.summarizeTrades(fills)
          const points = parseInt(result.totalVolume / VOLUME_BY_POINT)
          console.log(`✨ Last ${hour} hour(s) ✨`)
          console.log("💸 Fees", Number(parseFloat(result.totalFee).toFixed(2)))
          console.log("💰 Volume", Number(parseFloat(result.totalVolume).toFixed(0)))
          console.log("👀 Volume by 1 fee dol", result.volumeBylFee ? Number(parseFloat(result.volumeBylFee).toFixed(2)) : 0)
          console.log(`🔮 Estimated points`, points)
          console.log("")
          console.log("")
      }
     

       } catch (error) {
      console.log(error)
    }
  } 

  summarizeTrades(trades) {
    try {
    const bySymbol = trades.reduce((acc, { symbol, price, quantity, fee, side }) => {
      const p = parseFloat(price);
      const q = parseFloat(quantity);
      const f = parseFloat(fee);
      const volume = p * q;
      const pnl = side === 'Ask' ? volume : -volume;

      if (!acc[symbol]) {
        acc[symbol] = { totalFee: 0, totalVolume: 0, totalPnl: 0 };
      }

      acc[symbol].totalFee += f;
      acc[symbol].totalVolume += volume;
      acc[symbol].totalPnl += pnl;
      return acc;
    }, {});

    const overall = Object.values(bySymbol).reduce(
      (tot, curr) => ({
        totalFee: tot.totalFee + curr.totalFee,
        totalVolume: tot.totalVolume + curr.totalVolume
      }),
      { totalFee: 0, totalVolume: 0 }
    );

    const volumeBylFee = (overall.totalVolume / overall.totalFee ) 

    return {  
        totalFee: overall.totalFee, 
        totalVolume: overall.totalVolume, 
        volumeBylFee: isNaN(volumeBylFee) ? null : volumeBylFee 
      };

     } catch (error) {
      console.log(error)
      return null
    }
  }

}
export default new PnlController();