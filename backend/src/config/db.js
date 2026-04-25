const mongoose = require("mongoose");

const getConnectionHint = (error) => {
  const message = `${error?.name || ""} ${error?.message || ""}`.toLowerCase();

  if (message.includes("authentication failed")) {
    return "Invalid Atlas credentials. Verify your DB username/password in MONGODB_URI.";
  }

  if (
    message.includes("server selection") ||
    message.includes("timed out") ||
    message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("ssl") ||
    message.includes("tls")
  ) {
    return "MongoDB Atlas handshake/network issue. Confirm Atlas Network Access includes your IP (or 0.0.0.0/0 for testing).";
  }

  if (message.includes("querysrv") || message.includes("dns")) {
    return "DNS lookup failed for Atlas cluster. Check internet/DNS and cluster hostname in MONGODB_URI.";
  }

  return "Check MONGODB_URI format and Atlas connectivity settings.";
};

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error("MONGODB_URI is not defined in environment variables.");
    }

    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully.");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    console.error("MongoDB connection hint:", getConnectionHint(error));
    process.exit(1);
  }
};

module.exports = connectDB;
