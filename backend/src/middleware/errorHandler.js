const errorHandler = (err, req, res, next) => {
  console.error(err);

  if (err.name === "MulterError") {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "File too large. Maximum size is 5MB." });
    }
    return res.status(400).json({ message: err.message || "File upload error." });
  }

  return res.status(err.status || 500).json({
    message: err.message || "Internal server error."
  });
};

module.exports = errorHandler;
