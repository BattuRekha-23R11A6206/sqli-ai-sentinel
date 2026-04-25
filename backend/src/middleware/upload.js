const path = require("path");
const multer = require("multer");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimeTypes = [
    "application/javascript",
    "text/javascript",
    "application/x-javascript",
    "text/plain",
    "application/octet-stream"
  ];

  if (ext !== ".js") {
    return cb(new Error("Only .js files are allowed."));
  }

  if (file.mimetype && !allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Invalid file type. Please upload a JavaScript file."));
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

module.exports = upload;
