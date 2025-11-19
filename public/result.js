export function renderResult(j) {
  const out = document.getElementById("out");
  out.textContent = ""; // Clear previous results

  // Remove existing buttons if they exist
  const existingContainer = document.getElementById("result-buttons");
  if (existingContainer) {
    existingContainer.remove();
  }

  // Preview button
  const previewButton = document.createElement("button");
  previewButton.textContent = "Pré-visualizar";
  previewButton.onclick = () => {
    out.textContent = j.preview || j.raw || JSON.stringify(j, null, 2);
  };

  // Download button
  const downloadButton = document.createElement("button");
  downloadButton.textContent = `Baixar ${j.filename || "arquivo"}`;
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

  // Add buttons to the page
  const container = document.createElement("div");
  container.id = "result-buttons";
  container.style.display = "flex";
  container.style.gap = "10px";
  container.style.marginBottom = "10px";
  container.appendChild(previewButton);
  if (j.preview || j.raw) {
    container.appendChild(downloadButton);
  }

  out.before(container);
}