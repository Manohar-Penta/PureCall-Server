import "dotenv/config";
import express from "express";
import { IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

const app = express();
const port = process.env.PORT ?? 3000;

app.use(express.json());

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile("./public/index.html");
});

app.post("/", (req, res) => {
  console.log(req.body, req.headers);
  console.log("received!!");
  res.status(200);
});

export const server = app.listen(port, () => {
  console.log(`Listening on ${port}`);
});

const wss = new WebSocketServer({ server });

const clients: Record<string, WebSocket> = {};

wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
  const clientId: string = uuidv4();
  console.log(`${clientId} connected`);
  clients[clientId] = ws;

  ws.on("message", (message: Buffer) => {
    Message(wss, ws, Buffer.from(message).toString());
  });

  ws.on("close", () => {
    console.log(`${clientId} left`);
    delete clients[clientId];
  });

  ws.send(JSON.stringify({ type: "join", id: clientId }));
});

const messageModel = z.object({
  type: z.string(),
  sender: z.string(),
  target: z.string(),
  sdp: z.object({}).passthrough().optional(),
  ice_candidate: z.object({}).passthrough().optional(),
});

async function Message(wss: WebSocketServer, ws: WebSocket, message: string) {
  try {
    const data = await JSON.parse(message);
    const validData = messageModel.parse(data);
    console.log(validData.type, validData.sender, validData.target);
    if (clients[validData.target] == null) {
      console.log("user not found", validData);
    }
    clients[validData.target].send(JSON.stringify(validData), (err) => {
      if (!err) return;
      ws.send(
        JSON.stringify({ type: "error", msg: "Cannot find the Target!!" })
      );
    });
  } catch (error) {
    console.log(error);
    ws.send(JSON.stringify({ msg: "error occured", error }));
  }
}
