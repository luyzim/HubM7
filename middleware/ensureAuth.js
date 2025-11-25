module.exports = (req, res, next) => {
  if (req.session?.user) return next();

  // Se for navegação de página, redireciona para /login
  const wantsHtml = req.accepts("html") && !req.xhr;
  if (wantsHtml) return res.redirect("/login");

  // Fallback para chamadas de API/fetch
  return res.status(401).json({ error: "Você precisa estar logado." });
};
