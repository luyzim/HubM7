function normalizePythonOutput(stdout, stderr, exitCode) {
  if (exitCode !== 0) {
    // Prioritize stderr for the error message if it exists
    const error = stderr || `Script finalizado com código ${exitCode}`;
    // Try to parse stderr as JSON, in case the script sends a JSON error
    try {
      return JSON.parse(stderr);
    } catch (e) {
      return { success: false, error: error.trim(), data: stdout };
    }
  }
  try {
    // If the script succeeds, stdout is expected to be a JSON string
    return JSON.parse(stdout);
  } catch (e) {
    // If parsing fails, it might be a non-JSON success message or an error.
    // If there's no JSON, it's safer to assume an issue.
    return { success: false, error: "A saída do script não é um JSON válido.", data: stdout };
  }
}

function sendResponse(req, res, data, status = 200, options = {}) {
  // The `allowHtmlObject` seems to be a flag to allow sending non-JSON data
  // but the controller logic seems to always produce JSON via normalizePythonOutput.
  // This implementation will stick to sending JSON.
  res.status(status).json(data);
}

export {
  normalizePythonOutput,
  sendResponse,
};
