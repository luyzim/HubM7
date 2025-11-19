const express = require("express");
const http = require("http");
const path = require("path");
const { createLogger } = require("./utils/logging");
const routes = require("./routes");

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
createLogger(app);
app.use(express.static(path.join(process.cwd(), "public")));
app.use("/", routes);

const server = http.createServer(app);
server.setTimeout(15 * 60 * 1000);
const PORT = process.env.PORT || 3102;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Express rodando em http://0.0.0.0:${PORT}`);
});
