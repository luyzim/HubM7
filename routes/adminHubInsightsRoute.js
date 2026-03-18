import express from "express";

import {
  getHubInsightsReport,
  HubInsightsValidationError,
  MAX_HUB_INSIGHTS_DAYS,
} from "../services/hubInsightsService.js";

const router = express.Router();

router.get("/", async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const report = await getHubInsightsReport({
      from: req.query.from,
      to: req.query.to,
    });

    res.json(report);
  } catch (error) {
    if (error instanceof HubInsightsValidationError) {
      return res.status(400).json({
        error: error.message,
        maxIntervalDays: MAX_HUB_INSIGHTS_DAYS,
      });
    }

    console.error("[adminHubInsightsRoute]", error);
    return res.status(500).json({
      error: "Erro ao gerar os insights do HUB.",
    });
  }
});

export default router;
