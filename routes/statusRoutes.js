import express from "express";
const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    status: "Servidor Online",
    hora: new Date().toLocaleString(),
    uptime: process.uptime(),
  });
});

router.get("/me", (req, res) => {
  if (req.session && req.session.user) {
    return res.json(req.session.user);
  }
  res.status(401).json({ error: "Não autenticado" });
});

router.get("/automations", (req, res) => {
  const userRole = req.session?.user?.role;
  console.log("DEBUG: Buscando automações para role:", userRole);
  
  const allAutomations = [
    { title: "Add Ip UNIMED", link: "/api/unimed", role: "n2", task: "Firewall" },
    { title: "About", link: "/api/about", role: "admin", task: "about" },
    { title: "Boas Práticas - Mikrotik", link: "/api/bkpMkt", role: "n2", task: "BoasPraticas" },
    { title: "Reboot 4g RoyalFic", link: "/api/4g", role: "n1", task: "4g" },
    { title: "CCS - Mkt", link: "/api/mkt", role: "n2", task: "mkt" },
    { title: "CCS - Cisco", link: "/api/cisco", role: "n2", task: "cisco" },
    { title: "Hosts CCS (Fw)", link: "/host-ccs", role: "monitoring", task: "host-ccs" },
    { title: "Hosts ZEMA", link: "/host-zema", role: "monitoring", task: "host-zema" },
    { title: "BKP - oxidized", link: "/api/oxidized", role: "n2", task: "oxidized" },
    { title: "Triagem - n1", link: "/api/comandos-mkt", role: "n1", task: "mkt-n1" },
    { title: "CCS - FORTIGATE", link: "/api/ccsFortgate", role: "n1", task: "Firewall" },
    { title: "Wiki", link: "/api/wiki", role: "n2", task: "wiki" }
  ];

  const allowed = allAutomations.filter(auto => {
    if (userRole === "admin") return true;
    if (auto.role === "n2") return (userRole === "n2" || userRole === "monitoring");
    if (auto.role === "n1") return (userRole === "n1" || userRole === "n2");
    if (auto.role === "monitoring") return (userRole === "monitoring");
    return !auto.role;
  });

  console.log("DEBUG: Itens permitidos:", allowed.length);
  res.json(allowed);
});

export default router;
