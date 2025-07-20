
import dotenv from 'dotenv';
dotenv.config();
export default class StopEvaluator {

    constructor({ symbol, markPrice, orders, position, account }) {
    this.symbol = symbol;
    this.markPrice = markPrice;
    this.orders = orders || [];
    this.position = position;
    this.account = account;
    this.TRAILING_STOP_GAP = Number(process.env.TRAILING_STOP_GAP)
    this.VOLUME_ORDER = Number(process.env.VOLUME_ORDER);
    this.MAX_PERCENT_LOSS = Number(String(process.env.MAX_PERCENT_LOSS).replace("%","")) / 100
    this.MAX_PERCENT_PROFIT = Number(String(process.env.MAX_PERCENT_PROFIT).replace("%","")) / 100
    this.toDelete = [] 
    this.toCreate = [] 
    this.toForce = []
    }

    getMarkPriceFromPnl({ entryPrice, qty, totalFee, isLong, targetPnl }) {
        const q = Math.abs(qty);
        const pnlPlusFee = targetPnl + totalFee;
        if (isLong) {
            return pnlPlusFee / q + entryPrice;
        } else {
            return entryPrice - pnlPlusFee / q;
        }
    }

    filterOrders(orders, marketPrice) {
        const above = [];
        const below = [];

        for (const order of orders) {
            const price = parseFloat(order.price);
            if (price > marketPrice) {
            above.push(order);
            } else if (price < marketPrice) {
            below.push(order);
            }
        }

        // Sort above: farthest to nearest (descending)
        above.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

        // Sort below: nearest to farthest (descending, so first is closest)
        below.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));

        // Keep 2 farthest above and 1 closest below
        const keptOrders = [
            ...above.slice(0, 2),
            ...below.slice(0, 1)
        ];

        // Filter out the rest
        const removedOrders = orders.filter(order => !keptOrders.includes(order));

        return removedOrders;
    }   

    evaluate() {

        const { symbol, markPrice, orders, position, account } = this;
        
        if (!position || position.qty === 0) return {
            toCreate: this.toCreate,
            toDelete: this.toDelete,
            toForce: this.toForce
        }

        const { entryPrice, qty, isLong, notional } = position;
        const {makerFee, takerFee} = account
        const market = account.markets.find((el) => {return el.symbol === symbol})

        const feeOpen = (entryPrice * Math.abs(qty)) * makerFee
        const feeClose = (markPrice * Math.abs(qty)) * takerFee
        const totalFee = feeOpen + feeClose

        const pnl = (isLong ? (markPrice - entryPrice) : (entryPrice - markPrice)) * Math.abs(qty) - totalFee;

        const loss = (notional * this.MAX_PERCENT_LOSS)
        const profit = (notional * this.MAX_PERCENT_PROFIT)

        const {decimal_price, decimal_quantity, stepSize_quantity} = market

        const formatPrice = (value) => parseFloat(value).toFixed(decimal_price).toString();
        const formatQuantity = (value) => parseFloat(value).toFixed(decimal_quantity).toString();
        const quantity = formatQuantity(Math.floor(Math.abs(qty) / stepSize_quantity) * stepSize_quantity);

        const price = formatPrice(markPrice)

        const [current_stop] = orders.sort((a, b) => isLong ? Number(a.price) - Number(b.price) : Number(b.price) - Number(a.price))

        const markePrice_loss = formatPrice(this.getMarkPriceFromPnl({
            entryPrice,
            qty,
            totalFee,
            isLong,
            targetPnl: (loss * -1)
        }));

        const markePrice_profit = formatPrice(this.getMarkPriceFromPnl({
            entryPrice,
            qty,
            totalFee,
            isLong,
            targetPnl: profit
        }));

        const breakeven = formatPrice(this.getMarkPriceFromPnl({
            entryPrice,
            qty,
            totalFee,
            isLong,
            targetPnl: 0
        }));

        const newStop = formatPrice(this.getMarkPriceFromPnl({
            entryPrice,
            qty,
            totalFee,
            isLong,
            targetPnl: pnl - this.TRAILING_STOP_GAP 
        }));
        
        const limit_minimal_vol = notional < (this.VOLUME_ORDER * 0.2)
        const max_profit = isLong ? price > markePrice_profit : price < markePrice_profit
        const max_loss = isLong ? price < markePrice_loss : price > markePrice_loss

        
        if(max_profit || max_loss || limit_minimal_vol){
            this.toForce.push({
                symbol:symbol
            })
        } else {

            if(orders.length === 0) {

                this.toCreate.push({
                    symbol,
                    price: formatPrice(markePrice_profit),
                    side: isLong ? 'Ask' : 'Bid',
                    quantity: quantity
                })

                this.toCreate.push({
                    symbol,
                    price:formatPrice(markePrice_loss),
                    side: isLong ? 'Ask' : 'Bid',
                    quantity: quantity
                })

            } else if(orders.length === 1) {
                const current_price = Number(current_stop.price)
                if(current_price > markPrice && isLong || current_price < markPrice && !isLong) {
                    // is profit, add stop
                    this.toCreate.push({
                        symbol,
                        price:formatPrice(markePrice_loss),
                        side: isLong ? 'Ask' : 'Bid',
                        quantity: quantity
                    })
                } else {
                    // is stop, add profit 
                    this.toCreate.push({
                        symbol,
                        price: formatPrice(markePrice_profit),
                        side: isLong ? 'Ask' : 'Bid',
                        quantity: quantity
                    })
                }

            } else if(orders.length === 2) {
                const current_price = formatPrice(current_stop.price)
                const token_gap = this.TRAILING_STOP_GAP / quantity
                const suggestion_stop = formatPrice(isLong ? markPrice - token_gap : current_price + token_gap)

                const pnlGap = pnl - this.TRAILING_STOP_GAP
                const updateIsValid = isLong ? 
                (current_price < suggestion_stop && suggestion_stop < markPrice) : 
                (current_price > suggestion_stop && suggestion_stop > markPrice)
                
                if(pnlGap > 0) {

                    if(updateIsValid) {

                        this.toDelete.push({
                            id:current_stop.id,
                            symbol:current_stop.symbol
                        })

                        this.toCreate.push({
                            symbol,
                            price: suggestion_stop,
                            side: isLong ? 'Ask' : 'Bid',
                            quantity: quantity
                        })

                    }

                } 


            } else if(orders.length > 2) {
                const removes = this.filterOrders(orders)
                for (const remove of removes) {
                    this.toDelete.push({
                        id:remove.id,
                        symbol:remove.symbol
                    })
                }
            }

        }


        return {
            toCreate: this.toCreate,
            toDelete: this.toDelete,
            toForce: this.toForce
        }
    }
}

