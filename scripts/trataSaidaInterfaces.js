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

const GARY_PREFIXES = ["191.5.128.105/32", "191.5.128.106/32", "191.5.128.107/32"];
const PLANKTON_PREFIXES = ["45.160.230.105/32", "45.160.230.106/32", "45.160.230.0/22", "189.51.32.250/32"];

function inferVcnFromDstAddress(dstAddress) {
  if (!dstAddress) return "unknown";

  const ip = dstAddress.split('/')[0];

  for (const prefix of GARY_PREFIXES) {
    const cidr = new CIDR(prefix);
    if (cidr.contains(ip)) {
      return "gary";
    }
  }

  for (const prefix of PLANKTON_PREFIXES) {
    const cidr = new CIDR(prefix);
    if (cidr.contains(ip)) {
      return "plankton";
    }
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


const DEBUG = true;

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

    if (iface.interfaceName.startsWith('VLAN')) {
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
      console.log("ROUTE DROPPED (missing fields):", { rec, dstAddress, gateway, distance });
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


  const findPartnerForVcn = (vcnRoutes) => {
    if (DEBUG) console.log(`\nFinding partner for VCN routes:\n`, vcnRoutes);
    if (vcnRoutes.length === 0) return "";

    const bestRoute = vcnRoutes.reduce((min, r) =>
      parseInt(r.distance) < parseInt(min.distance) ? r : min
    );
    if (DEBUG) console.log(` -> Best route found:`, bestRoute);

    let partner = "";

    // Early exit: se o gateway for uma interface PPPoE, já encontramos!
    if (bestRoute.gateway && bestRoute.gateway.toLowerCase().startsWith('pppoe-')) {
        if (DEBUG) console.log(` -> Direct partner found from gateway (PPPoE): ${bestRoute.gateway}`);
        partner = bestRoute.gateway;
        return partner;
    }
    
    // 1ª Tentativa: Se o gateway for uma interface PPPoE, já encontramos!
    if (bestRoute.gateway && bestRoute.gateway.toLowerCase().startsWith('pppoe-')) {
        if (DEBUG) console.log(` -> Direct partner found from gateway (PPPoE): ${bestRoute.gateway}`);
        partner = bestRoute.gateway;
        return partner;
    }

    // 2ª Tentativa: Para rotas 'reachable' (v6), o status do gateway é a fonte mais confiável.
    if (bestRoute.gatewayStatus && /reachable/i.test(bestRoute.gatewayStatus)) {
      if (DEBUG) console.log(` -> Attempting partner find via 'gatewayStatus': ${bestRoute.gatewayStatus}`);
      const gs = bestRoute.gatewayStatus;

      // Caso 1: O parceiro é um túnel PPPoE nomeado.
      const pppoeMatch = gs.match(/pppoe-([^\s]+)/);
      if (pppoeMatch && pppoeMatch[1]) {
        if (DEBUG) console.log(` -> Partner found from gatewayStatus (PPPoE match): ${pppoeMatch[1]}`);
        partner = pppoeMatch[1];
      } else {
        // Caso 2: A rota sai por uma interface explícita (ex: "via ether2").
        const parts = gs.split(" ");
        const potentialIfaceName = parts[parts.length - 1];
        if (DEBUG) console.log(` -> Potential interface from gatewayStatus: ${potentialIfaceName}`);
        const iface = interfaces.find(
          (i) => i.interfaceName.toLowerCase() === potentialIfaceName.toLowerCase()
        );
        if (iface) {
          if (DEBUG) console.log(` -> Found matching interface:`, iface);
          partner = iface.comentario || "";
        }
      }
    }

    // 3ª Tentativa: Se as tentativas anteriores falharem (v7 ou rotas 'unreachable' em v6),
    // usamos o 'comentario' que já foi pré-calculado ou buscamos o comentário da interface do gateway.
    if (!partner) {
      if (bestRoute.comentario) {
        if (DEBUG) console.log(` -> No partner yet, using pre-calculated comment: ${bestRoute.comentario}`);
        partner = bestRoute.comentario;
      } else if (bestRoute.gateway) {
        if (DEBUG) console.log(` -> No pre-calculated comment, trying to find gateway interface: ${bestRoute.gateway}`);
        const gatewayIface = interfaces.find(
          (i) => i.interfaceName.toLowerCase() === bestRoute.gateway.toLowerCase()
        );
        if (gatewayIface && gatewayIface.comentario) {
          if (DEBUG) console.log(` -> Found comment on gateway interface: ${gatewayIface.comentario}`);
          partner = gatewayIface.comentario;
        }
      }
    }

    if (DEBUG) console.log(` -> Final partner for VCN: ${partner}`);
    return partner;
  };

  const garyPartner = findPartnerForVcn(routesByVcn.gary);
  const planktonPartner = findPartnerForVcn(routesByVcn.plankton);

  if (DEBUG) console.log("--- Finished findPartners ---");
  return { garyPartner, planktonPartner };
}
