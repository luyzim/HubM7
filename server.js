require("dotenv").config();
const ensureAuth = require("./middleware/ensureAuth");
const ensureAdmin = require("./middleware/ensureAdmin.js");
const ensureMonitoramento = require("./middleware/ensureMonitoramento.js");
const ensureN2 = require("./middleware/ensureN2.js");
const session = require("express-session");
const express = require("express");
const morgan = require("morgan");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
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
  const user = req.session?.user?.role || "guest";
  const userAgent = req.headers['user-agent'];
  return `user=${user} user-agent=${userAgent}`;
});

const flaskFormat = ':remote-addr - - [:date_flask] ":method :url HTTP/:http-version" :status :res[content-length] - :user-and-headers';
app.use(morgan(flaskFormat));



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

app.get("/oxidized", ensureAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "oxidized.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "about.html"));
});




const loginRouter = require("./routes/loginRoute.js");
const aboutRouter = require("./routes/aboutRoute.js");
const unimedRouter = require("./routes/unimedRoute.js");
const bkpMktRouter = require("./routes/bkpMktRoute.js");
const ficRouter = require("./routes/ficRoute.js");
const ccsMktRouter = require("./routes/MktCcsInternet.js");
const ccsCiscoRouter = require("./routes/MktCcsInternet.js");
const ccsStatusRouter = require("./routes/statusRoutes.js");
const mensagemRouter = require("./routes/mensagemRoute.js");
const hostCcsRouter = require("./routes/hostCcsRoute.js");
const comandosOxidizedRouter = require("./routes/comandosOxidizedRoute.js");


app.use("/api/login", loginRouter);
app.use("/api/about", ensureAdmin, aboutRouter);
app.use("/api/unimed", ensureAuth, unimedRouter);
app.use("/api/bkpMkt", ensureAuth, bkpMktRouter);
app.use("/api/4g", ensureAuth, ficRouter);
app.use("/api/template",ensureN2, require("./routes/templateRoute.js"));
app.use("/api/mkt",ensureN2, require("./routes/MktCcsInternet.js"));
app.use("/api/cisco",ensureN2, require("./routes/CiscoCcsInternet.js"));
app.use("/api/status",ensureAuth, require("./routes/statusRoutes"));
app.use("/api/tabela",ensureN2, mensagemRouter);
app.use("/api/hostCcs",ensureMonitoramento, hostCcsRouter);
app.use("/api/oxidized", ensureAuth, require("./routes/oxidizedRoute.js"));
app.use("/api/comandos-oxidized", ensureAuth, comandosOxidizedRouter);

const PORT = process.env.PORT || 3210;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`API Express ouvindo em http://${HOST}:${PORT}`);
});
