import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import AccountController from './AccountController.js';

export default class CacheController {
  constructor() {
    this.db = null;
    this.dbPath = path.resolve('./account_cache.db');
  }

  async init() {
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS account_config (
        id INTEGER PRIMARY KEY,
        fee REAL,
        makerFee REAL,
        takerFee REAL,
        leverage INTEGER,
        capitalAvailable REAL,
        markets TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async update() {
    try {
      const data = await AccountController.get();
      if (!data) throw new Error('Erro ao obter dados da API.');

      await this.init();

      await this.db.run(`DELETE FROM account_config;`);

      await this.db.run(`
        INSERT INTO account_config (
          fee,
          makerFee,
          takerFee,
          leverage,
          capitalAvailable,
          markets,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `, [
        data.fee,
        data.makerFee,
        data.takerFee,
        data.leverage,
        data.capitalAvailable,
        JSON.stringify(data.markets),
      ]);

      console.log("💾 Caching is Updated");

      return data;
    } catch (error) {
      console.error('Erro ao atualizar cache:', error.message);
      return null;
    }
  }

  async get() {
    try {
      await this.init();

      const row = await this.db.get(`SELECT * FROM account_config LIMIT 1`);
      if (!row) return null;

      return {
        fee: Number(row.fee),
        makerFee: Number(row.makerFee),
        takerFee: Number(row.takerFee),
        leverage: Number(row.leverage),
        capitalAvailable: Number(parseFloat(row.capitalAvailable).toFixed(2)),
        markets: JSON.parse(row.markets),
      };
    } catch (error) {
      console.error('Erro ao acessar cache:', error.message);
      return null;
    }
  }
}
