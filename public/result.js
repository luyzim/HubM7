export function showToast(message, type = 'success') {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    console.warn("Toast container not found. Message:", message, "Type:", type);
    return;
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 100);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 5000);
}


export function renderResult(j, opts = {}) {
  const outId = opts.outId || "out";
  const defaultContainer = outId === "out" ? "result-buttons" : `${outId}-buttons`;
  const containerId = opts.containerId || defaultContainer;
  const previewLabel = opts.previewLabel || "Pre-visualizar";
  const downloadLabel = opts.downloadLabel || `Baixar ${j.filename || "arquivo"}`;
  const onlyDownload = opts.onlyDownload || false;
  const wikiAction = opts.wikiAction || false; // New option for wiki upload
  const identifier = opts.identifier || ""; // New option for wiki path
  const numPa = opts.numPa || ""; // New option for wiki path

  const out = document.getElementById(outId);
  if (!out) return;
  out.textContent = "";

  const existingContainer = document.getElementById(containerId);
  if (existingContainer) existingContainer.remove();

  const container = document.createElement("div");
  container.id = containerId;
  container.style.display = "flex";
  container.style.gap = "10px";
  container.style.marginBottom = "10px";

  if (!onlyDownload) {
    const previewButton = document.createElement("button");
    previewButton.textContent = previewLabel;
    previewButton.onclick = () => {
      out.textContent = j.preview || j.raw || JSON.stringify(j, null, 2);
    };
    container.appendChild(previewButton);
  }

  const actionButton = document.createElement("button");
  actionButton.textContent = downloadLabel;
  actionButton.onclick = async () => {
    const content = j.preview || j.raw || JSON.stringify(j, null, 2);

    if (wikiAction) {
      // Logic for "Subir para Wiki"
      if (!identifier && !numPa) {
        showToast('Identificador ou NUM_PA ausentes para a Wiki.', 'error');
        return;
      }
      const toTitleParts = (s = "") => s.trim().toLowerCase().replace(/\b\p{L}/gu, (ch) => ch.toUpperCase()); 
                  // \b pega início de "palavra", e o hífen conta como separador

      const identifierFmt = toTitleParts(identifier); // "Centro-Sul-Mineiro"

      const wikiPath =`/Engenharia/Clientes/CCS-Sicoob-${identifierFmt}`.replace(/\s+/g, "-");      

      try {
        const response = await fetch('/api/wiki/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'append_block',
            path: wikiPath,
            text: content,
          }),
        });
        const result = await response.json();
        if (response.ok) {
          showToast(`Documentação feita na Wiki! para: "${wikiPath}"`, 'success');
        } else {
          showToast(`Erro ao enviar para a Wiki: ${result.error || 'Erro desconhecido'}`, 'error');
        }
      } catch (error) {
        showToast(`Falha na requisição para a Wiki: ${error.message}`, 'error');
      }

    } else {
      // Original download logic
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = j.filename || "download.txt"; // Changed to .txt for generic files
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (j.preview || j.raw || onlyDownload) container.appendChild(actionButton);

  out.before(container);
}