// middleware/ensureMonitoramento.js
export default (req, res, next) => {
  // 1. Verifica se está logado
  if (!req.session?.user) {
    const wantsHtml = req.accepts("html") && !req.xhr;
    if (wantsHtml) return res.redirect("/login");
    return res.status(401).json({ error: "Você precisa estar logado." });
  }

  // 2. Se estiver logado, verifica se a role é 'monitoring' OU 'admin'
  const { role } = req.session.user;
  if (role === 'monitoring' || role === 'admin') {
    return next(); // Permissão concedida
  }

  // 3. Se a role não for permitida, nega o acesso
  return res.status(403).json({ error: "Acesso negado. Requer permissão de monitoramento ou superior." });
};