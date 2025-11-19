// GARANTA que está exatamente assim:
const { runBridge } = require("../services/pythonRunner");
const { sendResponse, normalizePythonOutput } = require("../utils/response");

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

module.exports = { postRun }; // <-- ESTE EXPORT É O QUE IMPORTA

