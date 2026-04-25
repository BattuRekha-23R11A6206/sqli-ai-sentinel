const express = require("express");
const upload = require("../middleware/upload");
const { scanFile, scanCode, getScanById } = require("../controllers/scanController");

const router = express.Router();

router.post("/file", upload.single("file"), scanFile);
router.post("/code", scanCode);
router.get("/:id", getScanById);

module.exports = router;
