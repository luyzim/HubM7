import "dotenv/config";
import session from "express-session";
import express from "express";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

// Imports de middleware
import ensureAuth from "./middleware/ensureAuth.js";
import ensureAdmin from "./middleware/ensureAdmin.js";
import ensureMonitoramento from "./middleware/ensureMonitoramento.js";
import ensureN2 from "./middleware/ensureN2.js";
import ensureN1 from "./middleware/ensureN1.js";

// Imports de rotas

import loginRouter from "./routes/loginRoute.js";
import aboutRouter from "./routes/aboutRoute.js";
import unimedRouter from "./routes/unimedRoute.js";
import bkpMktRouter from "./routes/bkpMktRoute.js";
import ficRouter from "./routes/ficRoute.js";
import templateRouter from "./routes/templateRoute.js";
import mktRouter from "./routes/MktCcsInternet.js";
import ciscoRouter from "./routes/CiscoCcsInternet.js";
import statusRouter from "./routes/statusRoutes.js";
import mensagemRouter from "./routes/mensagemRoute.js";
import hostCcsRouter from "./routes/hostCcsRoute.js";
import oxidizedRouter from "./routes/oxidizedRoute.js";
import comandosOxidizedRouter from "./routes/comandosOxidizedRoute.js";
import hostZemaRouter from "./routes/hostZemaRoute.js";
import commandMktRouter from "./routes/commandMktRoute.js";
import changePasswordRouter from "./routes/changePasswordRoute.js";
import ccsFortgateRouter from "./routes/ccsFortgateRoute.js";
import loginOtrsRouter from "./routes/loginOtrsRoute.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());

app.set("trust proxy", true);

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Logger no formato Flask
morgan.token("date_flask", () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const mons = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${pad(d.getDate())}/${mons[d.getMonth()]}/${d.getFullYear()} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
});

morgan.token("user-and-headers", (req, res) => {
  const user = req.session?.user?.email || "guest";
  const userAgent = req.headers['user-agent'];
  return `user=${user} user-agent=${userAgent}`;
});

const flaskFormat = ':remote-addr - - [:date_flask] ":method :url HTTP/:http-version" :status :res[content-length] - :user-and-headers';
app.use(morgan(flaskFormat));

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, "public")));

// Frontend Routes
app.get("/", (req, res) => res.redirect("/guest"));

app.get("/guest", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "guest.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});
app.get("/home", ensureAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

app.get("/changepassword", ensureN1, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "changePassword.html"));
});

app.get("/oxidized", ensureN2, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "oxidized.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "about.html"));
});

app.get("/host-zema", ensureMonitoramento, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "hostZema.html"));
});

app.get("/host-ccs", ensureMonitoramento, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "hostCcs.html"));
});

app.get("/login-otrs", ensureN2, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "loginOtrs.html"));
});



// Backend Routes
 
app.use("/api/login", loginRouter);
app.use("/api/about", ensureAdmin, aboutRouter);
app.use("/api/unimed", ensureN2, unimedRouter);
app.use("/api/bkpMkt", ensureN2, bkpMktRouter);
app.use("/api/4g", ensureN1, ficRouter);
app.use("/api/template", ensureN2, templateRouter);
app.use("/api/mkt", ensureN2, mktRouter);
app.use("/api/cisco", ensureN2, ciscoRouter);
app.use("/api/status", ensureAuth, statusRouter);
app.use("/api/tabela", ensureN2, mensagemRouter);
app.use("/api/host-ccs", ensureMonitoramento, hostCcsRouter);
app.use("/api/oxidized", ensureN2, oxidizedRouter);
app.use("/api/comandos-oxidized", ensureN2, comandosOxidizedRouter);
app.use("/api/host-zema", ensureMonitoramento, hostZemaRouter);
app.use("/api/comandos-mkt", ensureN1, commandMktRouter);
app.use("/api/change-password", ensureN1, changePasswordRouter);
app.use("/api/ccsFortgate", ensureN1, ccsFortgateRouter);
app.use("/api/loginOtrs", ensureN2, loginOtrsRouter);

const PORT = process.env.PORT;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`API Express ouvindo em http://${HOST}:${PORT}`);
});
