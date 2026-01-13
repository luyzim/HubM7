// services/mktParser.js

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
  const re = new RegExp(`\b${key}=([^]*?)(?=\s+[A-Za-z0-9_-]+=|$`);
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

  const IFACE_PREFIX_RE = /^(ether|vlan|l2tp|pppoe|bridge|loopback|wlan|sfp|eoip|gre|vxlan)/i;

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
export function buildProviderHints(interfaces, routes) {
  const ifaceByName = new Map(
    interfaces.map((i) => [String(i.interfaceName || "").toLowerCase(), i])
  );

  return routes.map((r) => {
    let provider = "unknown";
    let evidence = "";

    const iface = ifaceByName.get(String(r.gateway || "").toLowerCase());
    const gw = String(r.gateway || "").toLowerCase();
    const routeComment = (r.comentario || "").toLowerCase();
    const ifaceComment = (iface?.comentario || "").toLowerCase();

    // Priority 1: Interface comment
    if (ifaceComment.includes("gary")) { provider = "gary"; evidence = "interface.comment"; }
    else if (ifaceComment.includes("plankton") || ifaceComment.includes("plakton")) { provider = "plankton"; evidence = "interface.comment"; }
    else if (ifaceComment.includes("weclix")) { provider = "weclix"; evidence = "interface.comment"; }
    else if (ifaceComment.includes("maxvibe")) { provider = "maxvibe"; evidence = "interface.comment"; }
    else if (ifaceComment.includes("radio")) { provider = "radio"; evidence = "interface.comment"; }
    else if (ifaceComment.includes("mpls")) { provider = "mpls"; evidence = "interface.comment"; }
    // Priority 2: Route comment
    else if (routeComment.includes("gary")) { provider = "gary"; evidence = "route.comment"; }
    else if (routeComment.includes("plankton") || routeComment.includes("plakton")) { provider = "plankton"; evidence = "route.comment"; }
    // Priority 3: Gateway name
    else if (gw.includes("weclix")) { provider = "weclix"; evidence = "gateway(name)"; }
    else if (gw.includes("maxvibe")) { provider = "maxvibe"; evidence = "gateway(name)"; }
    else if (gw.startsWith("pppoe-")) { provider = "pppoe"; evidence = "gateway(prefix)"; }
    else if (gw.startsWith("l2tp-")) { provider = "tunnel"; evidence = "gateway(prefix)"; }
    else if (gw.startsWith("vlan")) { provider = "vlan"; evidence = "gateway(prefix)"; }
    else if (gw.startsWith("ether")) { provider = "ether"; evidence = "gateway(prefix)"; }
    else { provider = "unknown"; evidence = "unclassified"; } // Default if no specific match

    return {
      vcn: r.vcn ?? "unknown",
      dstAddress: r.dstAddress ?? null,
      gateway: r.gateway ?? null,
      provider,
      evidence,
      ifaceComment: iface?.comentario || null,
    };
  });
}
