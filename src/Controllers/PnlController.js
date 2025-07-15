import History from '../Backpack/Authenticated/History.js';

class PnlController {
  async run(hour = 24) {
    try {
      
   
      const now = Date.now();                                  // timestamp atual em ms
      const oneDayAgo = now - hour * 60 * 60 * 1000;            // 24h atrás em ms

      // opcional: especifique um símbolo, ou passe null para todos
      const symbol = null;
      const orderId = null;

      // limite de registros por página (máx 1000), offset inicial e direção de ordenação
      const limit = 1000;
      const offset = 0;
      const fillType = null;      // ou 'Trade', 'Liquidation' etc.
      const marketType = null;    // array de tipos se precisar filtrar (SPOT, PERP)
      const sortDirection = 'Desc';

      const fills = await History.getFillHistory(
        symbol,
        orderId,
        oneDayAgo,
        now,
        limit,
        offset,
        fillType,
        marketType,
        sortDirection
      );
      const result = this.summarizeTrades(fills)
      console.log(`last ${hour}h:`, result);

       } catch (error) {
      console.log(error)
    }
  } 
  
  summarizeTrades(trades) {
    try {
      // Verifica se trades é válido
      if (!trades || !Array.isArray(trades) || trades.length === 0) {
        console.log('📊 Nenhum trade encontrado para análise');
        return { totalFee: 0, totalVolume: 0, volumeBylFee: 0 };
      }

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

      const volumeBylFee = overall.totalFee > 0 ? (overall.totalVolume / overall.totalFee) : 0;

      return { totalFee: overall.totalFee, totalVolume: overall.totalVolume, volumeBylFee: volumeBylFee };

    } catch (error) {
      console.error('❌ PnlController.summarizeTrades - Error:', error.message);
      return { totalFee: 0, totalVolume: 0, volumeBylFee: 0 };
    }
  }

}
export default new PnlController();