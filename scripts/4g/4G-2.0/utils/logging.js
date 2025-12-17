import fs from "fs";
import path from "path";
import morgan from "morgan";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createLogger(app) {
  const accessLogStream = fs.createWriteStream(path.join(process.cwd(), "access.log"), { flags: "a" });
  morgan.token("local-time", () => new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }));
  morgan.token("body", (req) => {
    try {
      if (!req.body || Object.keys(req.body).length === 0) return "-";
      const clone = { ...req.body }; // sanitize aqui, ex: delete clone.senha;
      return JSON.stringify(clone);
    } catch { return "-"; }
  });
  const fmt = ':local-time :remote-addr :method :url :status :res[content-length] - :response-time ms body=:body';
  app.use(morgan(fmt));                             // console
  app.use(morgan(fmt, { stream: accessLogStream })); // arquivo
}
export { createLogger };
