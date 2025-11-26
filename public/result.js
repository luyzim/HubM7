export function renderResult(j, opts = {}) {
  const outId = opts.outId || "out";
  const defaultContainer = outId === "out" ? "result-buttons" : `${outId}-buttons`;
  const containerId = opts.containerId || defaultContainer;
  const previewLabel = opts.previewLabel || "Pre-visualizar";
  const downloadLabel = opts.downloadLabel || `Baixar ${j.filename || "arquivo"}`;

  const out = document.getElementById(outId);
  if (!out) return;
  out.textContent = "";

  const existingContainer = document.getElementById(containerId);
  if (existingContainer) existingContainer.remove();

  const previewButton = document.createElement("button");
  previewButton.textContent = previewLabel;
  previewButton.onclick = () => {
    out.textContent = j.preview || j.raw || JSON.stringify(j, null, 2);
  };

  const downloadButton = document.createElement("button");
  downloadButton.textContent = downloadLabel;
  downloadButton.onclick = () => {
    const content = j.preview || j.raw || JSON.stringify(j, null, 2);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = j.filename || "download.crs";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const container = document.createElement("div");
  container.id = containerId;
  container.style.display = "flex";
  container.style.gap = "10px";
  container.style.marginBottom = "10px";
  container.appendChild(previewButton);
  if (j.preview || j.raw) container.appendChild(downloadButton);

  out.before(container);
}
