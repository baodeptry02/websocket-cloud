const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const app = express();
const axios = require("axios");
app.use(express.json());
const { HttpsProxyAgent } = require("https-proxy-agent");

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
  console.log("🔌 New client connected");
  socket.on("join_room", (userId) => {
    console.log("🚪 User joined room:", userId);
    socket.join(userId);
  });

  socket.on("new_order", (order) => {
    io.emit("update_orders", order);
  });

  socket.on("disconnect", () => {});
});

app.post("/new_order", (req, res) => {
  const order = req.body;

  if (!order) {
    return res.status(400).json({ message: "Invalid order data" });
  }
  console.log("📩 New order received:", order);
  io.emit("update_orders", order);
  res.status(201).json({ message: "Order broadcasted successfully" });
});

app.post("/webhook/payment", async (req, res) => {
  try {
    const { code: orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: "Missing orderId" });
    }

    try {
      const { data: orderData } = await axios.get(
        // `https://93f1-116-110-41-100.ngrok-free.app/lms-backend-1d9f5/us-central1/app/api/order/get-order-user/${orderId}`
        `http://localhost:5001/lms-backend-1d9f5/us-central1/app/api/order/get-order-user/${orderId}`
      );
      const userId = orderData.data;

      if (!userId) {
        return res
          .status(404)
          .json({ error: "User ID not found for this order" });
      }

      const { data: updateResponse } = await axios.post(
        // `https://93f1-116-110-41-100.ngrok-free.app/lms-backend-1d9f5/us-central1/app/api/order/${userId}/${orderId}`
        `http://localhost:5001/lms-backend-1d9f5/us-central1/app/api/order/${userId}/${orderId}`
      );
      const message =
        updateResponse.message || "Order status updated successfully";

      io.to(userId).emit("update_order", { message, userId, orderId });

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

const proxyConfig = {
  host: "44.218.183.55",
  port: 80,
};

axios.interceptors.request.use((config) => {
  console.log("Request URL:", config.url);
  console.log(
    "Proxy Agent:",
    config.httpsAgent ? config.httpsAgent.proxy : "No proxy"
  );
  return config;
});

async function getCoordinates(address) {
  try {
    const proxyUrl = proxyConfig.auth
      ? `http://${proxyConfig.auth.username}:${proxyConfig.auth.password}@${proxyConfig.host}:${proxyConfig.port}`
      : `http://${proxyConfig.host}:${proxyConfig.port}`;

    const proxyAgent = new HttpsProxyAgent(proxyUrl);

    const response = await axios.post(
      "http://www.vietbando.com/maps/ajaxpro/AJLocationSearch,Vietbando.Web.Library.ashx",
      {
        strKey: address,
        strWhat: "",
        strWhere: "$$",
        nPage: 1,
        nCLevel: 17,
        dbLX: 105.89589715003967,
        dbLY: 21.023072678594673,
        dbRX: 105.90193748474121,
        dbRY: 21.03112426564381,
        nSearchType: 0,
      },
      {
        headers: {
          Accept: "/",
          "Accept-Language": "en-US,en;q=0.9",
          "Content-Type": "application/json; charset=UTF-8",
          "X-AjaxPro-Method": "SearchResultWithAds",
          Cookie:
            "SL_G_WPT_TO=vi; SL_GWPT_Show_Hide_tmp=1; SL_wptGlobTipTmp=1; ASP.NET_SessionId=x34vabmq5w3mr1jw2vnjpgth; Culture=vi",
          Referer: "http://www.vietbando.com",
        },
        httpsAgent: proxyAgent,
      }
    );

    const rawData = response.data;
    const regex = /new Ajax\.Web\.DataTable\((.*?)\)/s;
    const match = rawData.match(regex);

    if (match && match[1]) {
      const result = match[1]
        .trim()
        .replace(/[\r\n]+/g, "")
        .replace(/\s+/g, " ");
      const dataArray = JSON.parse(`[${result}]`);
      const secondArray = dataArray[1] || [];

      const formattedData = secondArray
        .map((item) => ({
          lon: item[12] || 0, // Kinh độ
          lat: item[13] || 0, // Vĩ độ
        }))
        .filter((item) => item.lon && item.lat);

      return formattedData[0] || null;
    }
    return null;
  } catch (error) {
    console.error("Error:", error.message);
    return null;
  }
}

app.post("/get_coordinates", async (req, res) => {
  const { address } = req.body;

  if (!address) {
    return res.status(400).json({ error: "Missing address" });
  }

  const coordinates = await getCoordinates(address);

  if (!coordinates) {
    return res.status(404).json({ error: "Coordinates not found" });
  }

  res.status(200).json({ coordinates });
});

server.listen(5000, () => {
  console.log("WebSocket server running on port 5000");
});
