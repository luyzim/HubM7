// scripts/trataSaidaInterfaces.js
import CIDR from "ip-cidr";

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
  const ipAddress = [];

  for (const rec of records) {
    const isRoute = /\bdst-address=/.test(rec) && (/\bgateway=/.test(rec) || /\bimmediate-gw=/.test(rec));
    const isIface = /\bname=/.test(rec) && /\btype=/.test(rec);
    const isIpAddress = /\baddress=/.test(rec) && /\bnetwork=/.test(rec);

    if (isRoute) route.push(rec);
    else if (isIface) iface.push(rec);
    else if (isIpAddress) ipAddress.push(rec);
    else {
      // fallback
      if (/\bdst-address=/.test(rec)) route.push(rec);
      else if (/\bname=/.test(rec)) iface.push(rec);
      else if (/\baddress=/.test(rec)) ipAddress.push(rec);
    }
  }

  return {
    interfacesText: iface.join("\n"),
    routesText: route.join("\n"),
    ipAddressText: ipAddress.join("\n"),
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

const GARY_PREFIXES = ["191.5.128.105/32", "191.5.128.106/32", "191.5.128.107/32", "191.5.128.0/20"];
const PLANKTON_PREFIXES = ["45.160.230.105/32", "45.160.230.106/32", "45.160.228.0/22", "189.51.32.250/32"];

function inferVcnFromDstAddress(dstAddress) {
  if (!dstAddress) return "unknown";

  // 1. Verificação por correspondência exata do prefixo
  if (GARY_PREFIXES.includes(dstAddress)) return "gary";
  if (PLANKTON_PREFIXES.includes(dstAddress)) return "plankton";

  // 2. Verificação se o IP está contido em algum dos prefixos
  const ip = dstAddress.split('/')[0];

  for (const prefix of GARY_PREFIXES) {
    try {
      const cidr = new CIDR(prefix);
      if (cidr.contains(ip)) return "gary";
    } catch (e) { continue; }
  }

  for (const prefix of PLANKTON_PREFIXES) {
    try {
      const cidr = new CIDR(prefix);
      if (cidr.contains(ip)) return "plankton";
    } catch (e) { continue; }
  }

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
  if (DEBUG) console.log("--- Starting parseInterfaceOutputTerse ---");
  if (DEBUG) console.log("Raw text received:\n", text);

  const records = toRecords(text);
  if (DEBUG) console.log("Generated records:\n", records);

  const out = [];

  const IFACE_PREFIX_RE = /^(ether|vlan|l2tp|pppoe|lte|bridge|loopback|wlan|sfp|eoip|gre|vxlan)/i;

  for (const rec of records) {
    const interfaceName = pickKV(rec, "name");
    if (!interfaceName) continue;

    const comentario = pickKV(rec, "comment") || "";
    const parentInterfaceName = pickKV(rec, "interface") || null;
    const macAddress = pickKV(rec, "mac-address") || null; // Extrai o MAC address

    const normalized = interfaceName.toLowerCase();
    const ok =
      IFACE_PREFIX_RE.test(normalized) ||
      normalized.startsWith("pppoe-") ||
      normalized.startsWith("l2tp-");

    if (!ok) continue;

    out.push({ ip, interfaceName, comentario, parentInterfaceName, macAddress });
  }

  if (DEBUG) console.log("--- Finished parseInterfaceOutputTerse ---");
  if (DEBUG) console.log("Final parsed interfaces:\n", out);
  return out;
}

// ======================================================
// Parse IP Address (terse detail)
// Saída: [{ ip, address, interfaceName, comentario }]
// ======================================================
export function parseIpAddressOutputTerse(text, ip) {
  if (DEBUG) console.log("--- Starting parseIpAddressOutputTerse ---");
  if (DEBUG) console.log("Raw text received:\n", text);

  const records = toRecords(text);
  if (DEBUG) console.log("Generated records:\n", records);

  const out = [];

  for (const rec of records) {
    const address = pickKV(rec, "address");
    const interfaceName = pickKV(rec, "interface");
    if (!address || !interfaceName) continue;

    const comentario = pickKV(rec, "comment") || "";

    out.push({ ip, address, interfaceName, comentario });
  }

  if (DEBUG) console.log("--- Finished parseIpAddressOutputTerse ---");
  if (DEBUG) console.log("Final parsed IP addresses:\n", out);
  return out;
}


const DEBUG = false;

// ======================================================
// Parse Routes (terse detail)
// Saída: [{ vcn, ip, dstAddress, gateway, gatewayStatus, distance, comentario, active }]
// ======================================================
export function parseRouteOutputTerse(text, ip, ipAddresses = [], interfaces = []) {
  if (DEBUG) console.log("--- Starting parseRouteOutputTerse ---");
  if (DEBUG) console.log("Raw text received:\n", text);

  const records = toRecords(text);
  if (DEBUG) console.log("Generated records:\n", records);

  const out = [];

  // --- Lógica de Mapeamento Aprimorada ---
  const ifaceCommentMap = new Map();
  const ifaceParentMap = new Map();
  const macToEthernetName = new Map();
  const vlansToProcess = [];

  // Primeira passagem: coleta comentários e mapeia MACs de interfaces físicas
  for (const iface of interfaces) {
    if (!iface.interfaceName) continue;
    const name = iface.interfaceName.toLowerCase();
    
    if (iface.comentario) {
      ifaceCommentMap.set(name, iface.comentario);
    }
    
    // Mapeia MACs de portas ethernet físicas
    if (iface.interfaceName.startsWith('ether') && iface.macAddress) {
      macToEthernetName.set(iface.macAddress, name);
    }

    if (iface.interfaceName.startsWith('vlan')) {
      vlansToProcess.push(iface);
    }

    // Mantém a lógica original caso o `interface=` esteja presente
    if (iface.parentInterfaceName) {
      ifaceParentMap.set(name, iface.parentInterfaceName.toLowerCase());
    }
  }

  // Segunda passagem: Associa VLANs aos pais via MAC Address
  for (const vlan of vlansToProcess) {
    const vlanName = vlan.interfaceName.toLowerCase();
    // Só associa via MAC se não houver uma associação explícita
    if (!ifaceParentMap.has(vlanName) && vlan.macAddress) {
      const parentName = macToEthernetName.get(vlan.macAddress);
      if (parentName) {
        ifaceParentMap.set(vlanName, parentName);
      }
    }
  }
  // --- Fim da Lógica de Mapeamento ---

  for (const rec of records) {
    if (DEBUG) console.log(`\nProcessing record: ${rec}`);

    if (!/\bdst-address=/.test(rec) || !(/\bgateway=/.test(rec) || /\bimmediate-gw=/.test(rec))) {
      if (DEBUG) console.log(" -> Skipping record (doesn't look like a route).");
      continue;
    }

    let routeOriginalComment = pickKV(rec, "comment");
    let interfaceComment = null;

    const dstAddress = pickKV(rec, "dst-address");
    const gateway = pickKV(rec, "immediate-gw") || pickKV(rec, "gateway");
    const gatewayStatus = pickKV(rec, "gateway-status");
    const distance = pickKV(rec, "distance");

    if (DEBUG) {
        console.log(` -> dstAddress: ${dstAddress}`);
        console.log(` -> gateway: ${gateway}`);
        console.log(` -> gatewayStatus: ${gatewayStatus}`);
        console.log(` -> distance: ${distance}`);
    }


    if (!dstAddress || !gateway || distance == null) {
      continue;
    }
    
    const isUnreachable = gatewayStatus && /unreachable/i.test(gatewayStatus);
    if (isUnreachable && gateway) {
      const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(gateway);

      if (isIp) {
        let ipAddrInfo = null;
        for (const addr of ipAddresses) {
          try {
            const cidr = new CIDR(addr.address);
            if (cidr.contains(gateway)) {
              ipAddrInfo = addr;
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (ipAddrInfo && ipAddrInfo.interfaceName) {
          const ifaceName = ipAddrInfo.interfaceName.toLowerCase();
          const directComment = ifaceCommentMap.get(ifaceName);

          if (directComment) {
            interfaceComment = directComment;
          } else {
            const parentName = ifaceParentMap.get(ifaceName);
            if (parentName) {
              interfaceComment = ifaceCommentMap.get(parentName);
            }
          }
        }
      } else {
        const gatewayIfaceName = gateway.toLowerCase();
        const directComment = ifaceCommentMap.get(gatewayIfaceName);
        
        if (directComment) {
          interfaceComment = directComment;
        } else {
          const parentName = ifaceParentMap.get(gatewayIfaceName);
          if (parentName) {
            interfaceComment = ifaceCommentMap.get(parentName);
          }
        }
      }
    }

    let vcn = inferVcnFromDstAddress(dstAddress);
    if (vcn === 'unknown') {
      vcn = inferVcnFromComment(routeOriginalComment);
    }
    const flags = pickFlags(rec);
    const active = inferActive(flags, gatewayStatus);

    out.push({
      vcn,
      ip,
      dstAddress,
      gateway,
      gatewayStatus: gatewayStatus ?? null,
      distance: String(distance),
      comentario: interfaceComment ?? null,
      obs: routeOriginalComment ?? null,
      active: Boolean(active),
    });
  }
  
  if (DEBUG) console.log("--- Finished parseRouteOutputTerse ---");
  if (DEBUG) console.log("Final parsed routes:\n", out);
  return out;
}

// ======================================================
// Helpers: Provider hints (usa interfaces parseadas)
// ======================================================
export function findPartners(interfaces, routes, ipAddresses) {
  if (DEBUG) console.log("--- Starting findPartners ---");
  const routesByVcn = {
    gary: [],
    plankton: [],
  };

  for (const route of routes) {
    if (route.vcn === "gary") routesByVcn.gary.push(route);
    else if (route.vcn === "plankton") routesByVcn.plankton.push(route);
  }
  if (DEBUG) console.log("Routes grouped by VCN:\n", routesByVcn);


  const NOT_FOUND = "PARTNER_NOT_FOUND";

  const findPartnerForVcn = (vcnRoutes) => {
    if (!vcnRoutes || vcnRoutes.length === 0) return NOT_FOUND;

    const bestRoute = vcnRoutes.reduce((min, r) => {
      // Prioridade 1: Rota Ativa (A)
      if (r.active && !min.active) return r;
      if (!r.active && min.active) return min;

      // Prioridade 2: Menor Distância (se ambos tiverem o mesmo estado 'active')
      const distR = parseInt(r.distance) || 255;
      const distMin = parseInt(min.distance) || 255;
      return distR < distMin ? r : min;
    });

    let partner = "";

    // 1. PPPoE direto (v6 e v7)
    if (bestRoute.gateway?.toLowerCase().startsWith("pppoe-")) {
      return bestRoute.gateway;
    }

    // 2. gateway-status (RouterOS v6)
    if (bestRoute.gatewayStatus && /reachable/i.test(bestRoute.gatewayStatus)) {
      const gs = bestRoute.gatewayStatus;

      const pppoeMatch = gs.match(/pppoe-([^\s]+)/i);
      if (pppoeMatch) return pppoeMatch[0];

      const ifaceName = gs.split(" ").pop();
      const iface = interfaces.find(
        (i) => i.interfaceName.toLowerCase() === ifaceName.toLowerCase()
      );
      if (iface?.comentario) return iface.comentario;
    }

    // 3. Comentário pré-calculado (v7 enrichment)
    if (bestRoute.comentario) return bestRoute.comentario;

    // 4. Fallback por interface de gateway
    if (bestRoute.gateway) {
      const gwIface = interfaces.find(
        (i) => i.interfaceName.toLowerCase() === bestRoute.gateway.toLowerCase()
      );
      if (gwIface?.comentario) return gwIface.comentario;
    }

    // 5. Fallback corporativo (NUNCA quebrar)
    return NOT_FOUND;
  };

  const garyPartner = findPartnerForVcn(routesByVcn.gary);
  const planktonPartner = findPartnerForVcn(routesByVcn.plankton);

  return { garyPartner, planktonPartner };

  
}
