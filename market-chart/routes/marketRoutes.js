const express = require("express");
const router = express.Router();
const crypto = require("../services/binanceService");
const forex = require("../services/forexService");
const stock = require("../services/stockService");

function wrap(fn) {
  return async (req, res) => {
    try {
      const data = await fn(req);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  };
}

router.get(
  "/crypto/klines",
  wrap((req) => {
    const { symbol, interval, limit, endTime } = req.query;
    return crypto.getKlines(
      symbol || "BTCUSDT",
      interval || "1h",
      +limit || 500,
      endTime ? +endTime : undefined,
    );
  }),
);

router.get(
  "/crypto/symbols",
  wrap(() => crypto.getSymbols()),
);
router.get(
  "/crypto/ticker",
  wrap((req) => crypto.getTicker(req.query.symbol || "BTCUSDT")),
);

router.get(
  "/forex/klines",
  wrap((req) => {
    const { symbol, interval, limit, endTime } = req.query;
    return forex.getKlines(
      symbol || "EUR/USD",
      interval || "1h",
      +limit || 500,
      endTime ? +endTime : undefined,
    );
  }),
);

router.get(
  "/forex/symbols",
  wrap(() => forex.getSymbols()),
);

router.get(
  "/stock/klines",
  wrap((req) => {
    const { symbol, interval, limit, endTime } = req.query;
    return stock.getKlines(
      symbol || "AAPL",
      interval || "1d",
      +limit || 500,
      endTime ? +endTime : undefined,
    );
  }),
);

router.get(
  "/stock/symbols",
  wrap(() => stock.getSymbols()),
);

module.exports = router;
