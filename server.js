const express = require("express");
const morgan = require("morgan");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.set("trust proxy", true);

// Logger no formato Flask
morgan.token("date_flask", () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const mons = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${pad(d.getDate())}/${mons[d.getMonth()]}/${d.getFullYear()} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
});
const flaskFormat = ':remote-addr - - [:date_flask] ":method :url HTTP/:http-version" :status :res[content-length]';
app.use(morgan(flaskFormat));



// Frontend Routes
app.get("/", (req, res) => res.redirect("/home"));
app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "home.html"));
});

app.get("/about", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "about.html"));
});




const aboutRouter = require("./routes/aboutRoute.js");
const unimedRouter = require("./routes/unimedRoute.js");
const bkpMktRouter = require("./routes/bkpMktRoute.js");
const ficRouter = require("./routes/ficRoute.js");
const ccsMktRouter = require("./routes/MktCcsInternet.js");
const ccsCiscoRouter = require("./routes/MktCcsInternet.js");
const ccsStatusRouter = require("./routes/statusRoutes.js");

app.use("/api/about", aboutRouter);
app.use("/api/unimed", unimedRouter);
app.use("/api/bkpMkt", bkpMktRouter);
app.use("/api/4g", ficRouter);
app.use("/api/template", require("./routes/templateRoute.js"));
app.use("/api/mkt", require("./routes/MktCcsInternet.js"));
app.use("/api/cisco", require("./routes/CiscoCcsInternet.js"));
app.use("/api/status", require("./routes/statusRoutes"));

const PORT = process.env.PORT || 3210;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`API Express ouvindo em http://${HOST}:${PORT}`);
});