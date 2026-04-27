require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");
const scanRoutes = require("./routes/scan");
const historyRoutes = require("./routes/history");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: "*"
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/scan", scanRoutes);
app.use("/api/history", historyRoutes);

app.use(errorHandler);

const startServer = async () => {
  await connectDB();
  app.listen(port, () => {
    console.log(`Backend on port ${port}`);
  });
};

startServer();

module.exports = app;
