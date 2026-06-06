const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/market", require("./routes/marketRoutes"));
app.get("/", (_, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html")),
);
app.use((err, _, res, __) => res.status(500).json({ error: err.message }));

app.listen(PORT, () => {
  console.log(`\n  ✦ Market Chart Pro → http://localhost:${PORT}\n`);
});
