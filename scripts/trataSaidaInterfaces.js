// scripts/trataSaidaInterfaces.js

// ======================================================
// Helpers: stdout "recordization" (conserta quebras de linha)
// - RouterOS às vezes quebra linha no meio. A gente reconstrói.
// ======================================================
function toRecords(text) {
  const rawLines = text.split(/\r?\n/);
  const records = [];
  let cur = "";

  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) continue;

    // Novo registro começa com índice: "0 ", "1 ", "10 "...
    if (/^\d+\s/.test(line)) {
      if (cur) records.push(cur.trim());
      cur = line;
    } else {
      // continuação do registro anterior
      cur += " " + line;
    }
  }
  if (cur) records.push(cur.trim());
  return records;
}

// ======================================================
// Split: separa interfaces/rotas de forma robusta
// ======================================================
export function splitSuperOutput(text) {
  const records = toRecords(text);

  const iface = [];
  const route = [];

  for (const rec of records) {
    const isRoute = /\bdst-address=/.test(rec) && /\bgateway=/.test(rec);
    const isIface = /\bname=/.test(rec) && /\btype=/.test(rec);

    if (isRoute) route.push(rec);
    else if (isIface) iface.push(rec);
    else {
      // fallback
      if (/\bdst-address=/.test(rec)) route.push(rec);
      else if (/\bname=/.test(rec)) iface.push(rec);
    }
  }

  return {
    interfacesText: iface.join("\n"),
    routesText: route.join("\n"),
  };
}

// ======================================================
// Parser helpers: pega key=... aceitando chaves com hífen
// Ex: default-name=, gateway-status=, target-scope=, etc.
// ======================================================
const pickKV = (line, key) => {
  const re = new RegExp(`\\b${key}=([^]*?)(?=\\s+[A-Za-z0-9_-]+=|$)`);
  const m = line.match(re);
  return m ? m[1].trim() : null;
};

function pickFlags(rec) {
  // captura trecho entre índice e primeiro "xxx="
  // ex: "0 A S comment=..." => "A S"
  const m = rec.match(/^\d+\s+(.+?)\s+[A-Za-z0-9_-]+=/);
  return m ? m[1].trim() : "";
}

function inferVcnFromComment(comentario) {
  const c = (comentario || "").toLowerCase();
  if (c.includes("gary")) return "gary";
  if (c.includes("plankton") || c.includes("plakton")) return "plankton";
  return "unknown";
}

function inferActive(flags, gatewayStatus) {
  if (flags && /\bA\b/.test(flags)) return true;
  if (gatewayStatus && /reachable/i.test(gatewayStatus) && !/unreachable/i.test(gatewayStatus)) return true;
  return false;
}

// ======================================================
// Parse Interfaces (terse detail)
// Saída: [{ ip, interfaceName, comentario }]
// ======================================================
export function parseInterfaceOutputTerse(text, ip) {
  const records = toRecords(text);
  const out = [];

  const IFACE_PREFIX_RE = /^(ether|vlan|l2tp|pppoe|lte|bridge|loopback|wlan|sfp|eoip|gre|vxlan)/i;

  for (const rec of records) {
    const interfaceName = pickKV(rec, "name");
    if (!interfaceName) continue;

    const comentario = pickKV(rec, "comment") || "";

    const normalized = interfaceName.toLowerCase();
    const ok =
      IFACE_PREFIX_RE.test(normalized) ||
      normalized.startsWith("pppoe-") ||
      normalized.startsWith("l2tp-");

    if (!ok) continue;

    out.push({ ip, interfaceName, comentario });
  }

  return out;
}

// ======================================================
// Parse Routes (terse detail)
// Saída: [{ vcn, ip, dstAddress, gateway, gatewayStatus, distance, comentario, active }]
// ======================================================
export function parseRouteOutputTerse(text, ip) {
  const records = toRecords(text);
  const out = [];

  for (const rec of records) {
    if (!/\bdst-address=/.test(rec) || !/\bgateway=/.test(rec)) continue;

    const comentario = pickKV(rec, "comment");
    const dstAddress = pickKV(rec, "dst-address");
    const gateway = pickKV(rec, "gateway");
    const gatewayStatus = pickKV(rec, "gateway-status");
    const distance = pickKV(rec, "distance");

    if (!dstAddress || !gateway || distance == null) {
      console.log("ROUTE DROPPED (missing fields):", {
        rec,
        dstAddress,
        gateway,
        distance,
      });
      continue;
    }
    
    const vcn = inferVcnFromComment(comentario); 
    const flags = pickFlags(rec);
    const active = inferActive(flags, gatewayStatus);

    out.push({
      vcn,
      ip,
      dstAddress,
      gateway,
      gatewayStatus: gatewayStatus ?? null,
      distance: String(distance),
      comentario: comentario ?? null,
      active: Boolean(active),
    });
  }

  return out;
}

// ======================================================
// Helpers: Provider hints (usa interfaces parseadas)
// ======================================================
export function findPartners(interfaces, routes) {
  const routesByVcn = {
    gary: [],
    plankton: [],
  };

  for (const route of routes) {
    if (route.vcn === "gary") routesByVcn.gary.push(route);
    else if (route.vcn === "plankton") routesByVcn.plankton.push(route);
  }

  let garyPartner = "";
  if (routesByVcn.gary.length > 0) {
    const bestGaryRoute = routesByVcn.gary.reduce((min, r) =>
      parseInt(r.distance) < parseInt(min.distance) ? r : min
    );

    if (bestGaryRoute.gatewayStatus) {
      const gs = bestGaryRoute.gatewayStatus;
      const pppoeMatch = gs.match(/pppoe-([^\s]+)/);
      if (pppoeMatch && pppoeMatch[1]) {
        garyPartner = pppoeMatch[1];
      } else {
        const parts = gs.split(" ");
        const potentialIfaceName = parts[parts.length - 1];
        const iface = interfaces.find(
          (i) => i.interfaceName.toLowerCase() === potentialIfaceName.toLowerCase()
        );
        if (iface) {
          garyPartner = iface.comentario || "";
        }
      }
    }
  }

  let planktonPartner = "";
  if (routesByVcn.plankton.length > 0) {
    const bestPlanktonRoute = routesByVcn.plankton.reduce((min, r) =>
      parseInt(r.distance) < parseInt(min.distance) ? r : min
    );

    if (bestPlanktonRoute.gatewayStatus) {
      const gs = bestPlanktonRoute.gatewayStatus;
      const pppoeMatch = gs.match(/pppoe-([^\s]+)/);
      if (pppoeMatch && pppoeMatch[1]) {
        planktonPartner = pppoeMatch[1];
      } else {
        const parts = gs.split(" ");
        const potentialIfaceName = parts[parts.length - 1];
        const iface = interfaces.find(
          (i) => i.interfaceName.toLowerCase() === potentialIfaceName.toLowerCase()
        );
        if (iface) {
          planktonPartner = iface.comentario || "";
        }
      }
    }
  }

  return { garyPartner, planktonPartner };
}
