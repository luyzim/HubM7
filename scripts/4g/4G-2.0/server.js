import express from "express";
import http from "http";
import path from "path";
import { createLogger } from "./utils/logging.js";
import routes from "./routes/index.js"; // Assuming routes has an index.js exporting default
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
createLogger(app);
app.use(express.static(path.join(__dirname, '..', '..', '..', 'public')));
app.use("/", routes);

const server = http.createServer(app);
server.setTimeout(15 * 60 * 1000);
const PORT = process.env.PORT || 3102;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Express rodando em http://0.0.0.0:${PORT}`);
});
