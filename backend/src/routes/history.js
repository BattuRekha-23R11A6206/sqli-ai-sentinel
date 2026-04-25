const express = require("express");
const { getHistory, deleteHistoryItem, getStats } = require("../controllers/historyController");

const router = express.Router();

router.get("/", getHistory);
router.delete("/:id", deleteHistoryItem);
router.get("/stats", getStats);

module.exports = router;
