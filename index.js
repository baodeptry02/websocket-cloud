const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const app = express();
const axios = require("axios");
app.use(express.json());

// Cho phép CORS
const corsOptions = {
  origin: "http://localhost:3000",
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Chỉ định frontend
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("User connected: " + socket.id);

  socket.on("new_order", (order) => {
    console.log("New order received:", order);
    io.emit("update_orders", order);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

app.post("/new_order", (req, res) => {
  const order = req.body;

  if (!order) {
    return res.status(400).json({ message: "Invalid order data" });
  }

  io.emit("update_orders", order);
  res.status(201).json({ message: "Order broadcasted successfully" });
});

app.post("/webhook/payment", async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || !content.includes("-")) {
      return res.status(400).json({ error: "Invalid transaction content" });
    }

    const [userId, orderId] = content.split("-");

    const baseURL =
      "http://localhost:5001/lms-backend-1d9f5/us-central1/app/api";
    await axios.post(`${baseURL}/order/${userId}/${orderId}`);

    io.emit("update_order", { message: `Payment order ${orderId} success` });

    res.status(200).json({ message: "Order updated successfully" });
  } catch (error) {
    console.error("❌ Lỗi webhook:", error.message);
    res.status(500).json({ error: "Error processing webhook" });
  }
});

// Chạy server trên port 5000
server.listen(5000, () => {
  console.log("WebSocket server running on port 5000");
});
