import { runBridge } from "../services/pythonRunner.js";
import { sendResponse, normalizePythonOutput } from "../utils/response.js";

async function postRun(req, res) {
  try {
    const { unidade } = req.body || {};

    if (!unidade) {
      return sendResponse(
        req,
        res,
        { success: false, error: "Unidade não fornecida" },
        400,
        { allowHtmlObject: true }
      );
    }

    // Timeout da requisição (15 min)
    req.setTimeout(15 * 60 * 1000);

    const { code, out, err } = await runBridge(unidade, process.cwd());

    console.log("[OK] Rebootado 4g:", unidade, err || "");

    // console.log(
    //   `[bridge_cli] exit=${code} unidade="${unidade}" stdout=${(out || "").slice(0, 500)} stderr=${(err || "").slice(0, 500)}`
    // );

    const normalized = normalizePythonOutput(out, err, code);

    const httpStatus =
      !normalized || normalized.success === false
        ? (normalized?.error || "").includes("Não encontrado")
          ? 404
          : 500
        : 200;

    return sendResponse(req, res, normalized, httpStatus, {
      allowHtmlObject: true,
    });
  } catch (error) {
    console.error(
      `[ERROR] Falha inesperada ao executar reboot 4g. unidade="${req?.body?.unidade || ""}"`,
      error
    );

    // Evita "Cannot set headers after they are sent"
    if (res.headersSent) return;

    return sendResponse(
      req,
      res,
      {
        success: false,
        error: "Erro interno ao processar a solicitação",
        details: process.env.NODE_ENV !== "production" ? String(error?.message || error) : undefined,
      },
      500,
      { allowHtmlObject: true }
    );
  }
}

export { postRun };