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

  socket.on("join_room", (userId) => {
    console.log("User joined room:", userId);
    socket.join(userId);
  });

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
    const { content: orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "Missing orderId" });
    }

    try {
      const { data: orderData } = await axios.get(
        `https://93f1-116-110-41-100.ngrok-free.app/lms-backend-1d9f5/us-central1/app/api/order/get-order-user/${orderId}`
      );
      const userId = orderData.data;

      if (!userId) {
        return res
          .status(404)
          .json({ error: "User ID not found for this order" });
      }

      const { data: updateResponse } = await axios.post(
        `https://93f1-116-110-41-100.ngrok-free.app/lms-backend-1d9f5/us-central1/app/api/order/${userId}/${orderId}`
      );
      const message =
        updateResponse.message || "Order status updated successfully";

      io.to(userId).emit("update_order", message);

      res.status(200).json({ message });
    } catch (error) {
      console.error(
        "❌ Error updating order:",
        error.response?.data || error.message
      );
      res.status(500).json({ error: "Error updating order" });
    }
  } catch (error) {
    console.error("❌ Webhook error:", error.message);
    res.status(500).json({ error: "Error processing webhook" });
  }
});

server.listen(5000, () => {
  console.log("WebSocket server running on port 5000");
});
