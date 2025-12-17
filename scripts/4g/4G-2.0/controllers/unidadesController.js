import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lê só a coluna "unidade" do CSV
function lerCSVUnidades(csvPath) {
  const raw = fs.readFileSync(csvPath, "utf-8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  const idxUnidade = headers.indexOf("unidade");
  if (idxUnidade === -1) return [];
  return lines
    .slice(1)
    .map(l => l.split(","))
    .filter(cols => cols[idxUnidade] && cols[idxUnidade].trim().length > 0)
    .map(cols => cols[idxUnidade].trim());
}

async function getUnidades(req, res) {
  try {
    const csvPath =
      process.env.CSV_PATH ||
      path.join(process.cwd(), "data", "ips_RoyalFic.csv");
    const unidades = lerCSVUnidades(csvPath);

    // Responde num formato que seu front entende (array “cru”)
    // Se você preferir o envelope: res.json({ success:true, data: unidades })
    res.json(unidades);
  } catch (e) {
    console.error("[getUnidades] erro:", e);
    res.status(500).json({ success: false, error: e.message || "Falha ao ler CSV" });
  }
}

// ⚠️ exporte exatamente assim:
export { getUnidades };
