// GARANTA que está exatamente assim:
import { runBridge } from "../services/pythonRunner.js";
import { sendResponse, normalizePythonOutput } from "../utils/response.js";

async function postRun(req, res) {
  const { unidade } = req.body || {};
  if (!unidade) {
    return sendResponse(req, res, { success: false, error: "Unidade não fornecida" }, 400, { allowHtmlObject: true });
  }
  req.setTimeout(15 * 60 * 1000);
  const { code, out, err } = await runBridge(unidade, process.cwd());
  console.log(`[bridge_cli] exit=${code} unidade="${unidade}" stdout=${(out||"").slice(0,500)} stderr=${(err||"").slice(0,500)}`);
  const normalized = normalizePythonOutput(out, err, code);
  const httpStatus = (!normalized || normalized.success === false)
    ? ((normalized?.error || "").includes("Não encontrado") ? 404 : 500)
    : 200;
  return sendResponse(req, res, normalized, httpStatus, { allowHtmlObject: true });
}

export { postRun }; // <-- ESTE EXPORT É O QUE IMPORTA

