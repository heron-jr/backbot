# Backbot
A crypto trading bot for Backpack Exchange. It trades perpetual futures automatically using custom strategies and real-time market data.
Use at your own risk – bugs may exist, and the logic won't always yield profits.
But if you know what you're doing, it might save you some time.

# Steps
In order to run the script you need to:

* Install nodejs - https://nodejs.org/pt/download
* Create an subaccount in backpack exclusive for bot (low fund for risk)
* Create API Key for backpack exchange subaccount
* Configure the file .env with your setup, Save file.
* Run in terminal npm start

# Configs

## Global Configs

* `BACKPACK_API_KEY` Your Backpack Exchange API key.  
* `BACKPACK_API_SECRET` Your Backpack Exchange API secret.  
* `VOLUME_BY_POINT` Your average volume per point on Backpack. For example: `600`. The bot will understand that for every $600 traded, 1 point is gained, estimating progress.  
* `PREVIEW_FARM_LAST_HOURS` Number of past hours to preview bot activity. For example: `5` will return the last 5 hours of performance.  
* `LOG` Enables visible logs in the terminal when set to `true`; disables when `false`.  
* `TRADING_STRATEGY` Choose your preferred strategy. Available options: `DEFAULT`, `AUTOMATIC_STOP`, and `GRID`.  

---

## 1. `DEFAULT` MODE

Find market opportunities and open limit long or short positions with stop loss and take profit. Stop loss can be enabled optionally.

* `AUTHORIZED_MARKET` Markets allowed for trading. If set to `'[]'`, all markets will be used. To restrict to specific markets, use something like:  
  `'["BTC_USDC_PERP", "SOL_USDC_PERP", "ETH_USDC_PERP"]'`  
* `CERTAINTY` Minimum certainty level required by the algorithm to open an order. Higher values will result in fewer trades. Range: `0 to 100`.  
* `VOLUME_ORDER` Default order volume in USD.  
* `ENABLE_STOPLOSS` Enables stop loss from the `AUTOMATIC_STOP` module when set to `true`; disables when `false`. Can be used together with `DEFAULT`.  
* `MAX_ORDER_OPEN` Maximum number of orders that can be open simultaneously (includes untriggered orders).  
* `UNIQUE_TREND` If set to `''`, both LONG and SHORT positions are allowed. To restrict only LONG, use `"LONG"`; for SHORT only, use `"SHORT"`.  

---

## 2. `AUTOMATIC_STOP` MODE

Monitors open orders and attempts to update stop losses based on profit gaps.

* `TRAILING_STOP_GAP` Minimum acceptable gap in USD between the current stop loss and the next one. Example: If profit increases by `$1`, the stop will be updated.  
* `MAX_PERCENT_LOSS` Maximum acceptable loss percentage, e.g., `1%`. This is calculated based on order volume — be cautious when using leverage.  
* `MAX_PERCENT_PROFIT` Maximum profit target percentage, e.g., `2%`. Also based on order volume — leverage applies.  

---

## 3. `GRID` MODE

Places orders above and below the current price to create volume in sideways markets.

* `GRID_MARKET`  
  Market pair to be used in grid mode.  
  Example: `"SOL_USDC_PERP"`  

* `NUMBER_OF_GRIDS`  
  Total number of grid levels the bot will create between `LOWER_PRICE` and `UPPER_PRICE`.  
  Example: `100` creates 100 evenly spaced orders within the defined price range.  

* `UPPER_PRICE`  
  Highest price where the grid will place orders. No orders will be created above this value.  
  Example: `185`  

* `LOWER_PRICE`  
  Lowest price where the grid will place orders. No orders will be created below this value.  
  Example: `179`  

* `UPPER_FORCE_CLOSE`  
  If the market price reaches or exceeds this value, all open grid positions will be force-closed (top trigger).  
  Example: `185.5`  

* `LOWER_FORCE_CLOSE`  
  If the market price hits or drops below this value, all open grid positions will be force-closed (bottom trigger).  
  Example: `178`  

* `GRID_PNL`  
  Estimated profit target for the grid. Once reached, all positions are closed at market and the grid is rebuilt.  
  Example: `10`


```shell
    npm install 
    npm start
```
# Honorable Mention

- **[@MBFC24](https://x.com/MBFC24)**  
  Suggested a strategy using neutral delta with collateral in the native token. I’m considering integrating this with real-time funding rates to enable shorting — this will be implemented soon as the `LOOP_HEDGE` mode.

- **[@Coleta_Cripto](https://x.com/Coleta_Cripto)**  
  Suggested a mode to simplify the process of earning Backpack’s `Achievements`. Coming soon!

- **[pordria](https://github.com/pordria)**  
  Created a Backpack grid bot. This project is based on their logic.

- **[@owvituh](https://x.com/owvituh) - [GitHub](https://github.com/OvictorVieira/backbot)**  
  Forked my bot and added multi-account and multi-strategy support. I’ve taken several ideas from it for this version.

---

# Coming Soon

1. `LOOP_HEDGE` Mode – Neutral delta with funding-based shorting  
2. `Achievements` Mode – Automates collection of Backpack achievements  
3. `FRONT RUN` Mode – Reacts to new token listings in real-time

---

# Sponsor

If this bot has helped you, consider buying me a coffee!

**SOL Address:**  
`8MeRfGewLeU419PDPW9HGzM9Aqf79yh7uCXZFLbjAg5a`
