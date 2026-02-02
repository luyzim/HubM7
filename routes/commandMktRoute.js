import express from "express";
import path from "path";
import { spawn } from "child_process";
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "url";
import {
  findPartners,
  splitSuperOutput,
  parseInterfaceOutputTerse,
  parseRouteOutputTerse,
  parseIpAddressOutputTerse,
} from "../scripts/trataSaidaInterfaces.js";

const prisma = new PrismaClient();
const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PY_CMD = process.platform === "win32" ? "python" : "python3";
const SPAWN_OPTS = {
  cwd: path.join(__dirname, ".."),
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, PYTHONIOENCODING: "utf-8" },
};

// ======================================================
// Constantes de validação do endpoint scan-super
// ======================================================
const SUPER_SCAN_CMD =
  "/interface print detail terse without-paging; /ip route print detail terse without-paging where dst-address=191.5.128.105/32; /ip route print detail terse without-paging where dst-address=191.5.128.106/32; /ip route print detail terse without-paging where dst-address=191.5.128.107/32; /ip route print detail terse without-paging where dst-address =45.160.230.105/32 ; /ip route print detail terse without-paging where dst-address =45.160.230.106/32; /ip route print detail terse without-paging where dst-address =45.160.228.0/22; /ip route print detail terse without-paging where dst-address =189.51.32.250/32; /ip address print terse without-paging";

// ======================================================
// Endpoint: scan-super (captura stdout completo, parseia, salva e retorna JSON)
// ======================================================
router.post("/scan-super", async (req, res) => {
  const { ip, command } = req.body;

  if (!ip || !command) {
    return res.status(400).json({ ok: false, error: "IP e command são obrigatórios" });
  }

  if (command !== SUPER_SCAN_CMD) {
    return res.status(400).json({ ok: false, error: "Comando inválido para este endpoint" });
  }

  const scriptPath = path.join(__dirname, "..", "scripts", "comandosMkt.py");
  const py = spawn(PY_CMD, [scriptPath, ip, command], SPAWN_OPTS);

  let fullStdout = "";
  let fullStderr = "";

  py.stdout.on("data", (d) => (fullStdout += d.toString("utf-8")));
  py.stderr.on("data", (d) => (fullStderr += d.toString("utf-8")));

  py.on("close", async (code) => {
    if (code !== 0) {
      return res.status(500).json({ ok: false, error: "Python falhou", details: fullStderr });
    }

    try {
      const { interfacesText, routesText, ipAddressText } = splitSuperOutput(fullStdout);

      const parsedIpAddresses = parseIpAddressOutputTerse(ipAddressText, ip);
      const parsedIfaces = parseInterfaceOutputTerse(interfacesText, ip);
      const ifaceByName = new Map(
        parsedIfaces.map((i) => [String(i.interfaceName || "").toLowerCase(), i])
      );
      const parsedRoutes = parseRouteOutputTerse(routesText, ip, parsedIpAddresses, parsedIfaces);

      if (!parsedIfaces.length && !parsedRoutes.length) {
        return res.status(404).json({ ok: false, error: "Nada parseável no stdout (interfaces/rotas vazias)" });
      }

      const { garyPartner, planktonPartner } = findPartners(parsedIfaces, parsedRoutes, parsedIpAddresses);

      const result = await prisma.$transaction(async (tx) => {
        const scan = await tx.mkt_scan.create({
          data: {
            routerIp: ip,
            parceiro_gary: garyPartner,
            parceiro_plakton: planktonPartner,
          },
        });
        const scanId = scan.id;

        // 1) salva interfaces em interfaces_mkt
        const savedIfaces = [];
        for (const iface of parsedIfaces) {
          if (!iface.interfaceName) continue;

          const row = await tx.interfaces_mkt.upsert({
            where: { ip_interfaceName: { ip: iface.ip, interfaceName: iface.interfaceName } },
            update: { comentario: iface.comentario ?? null, macAddress: iface.macAddress ?? null, scanId },
            create: { ip: iface.ip, interfaceName: iface.interfaceName, comentario: iface.comentario ?? null, macAddress: iface.macAddress ?? null, scanId },
          });

          savedIfaces.push(row);
        }

        // 2) Com base nas interfaces salvas, popula a tabela filha de endereços IP
        const interfaceNameToIdMap = new Map(savedIfaces.map(i => [i.interfaceName.toLowerCase(), i.id]));
        const savedIpAddresses = [];

        for (const addr of parsedIpAddresses) {
          if (!addr.address || !addr.interfaceName) continue;

          const parentInterfaceId = interfaceNameToIdMap.get(addr.interfaceName.toLowerCase());
          if (!parentInterfaceId) continue; // Não salva IP se a interface pai não foi salva

          const ipRow = await tx.interfaces_ip_address.upsert({
            where: { interfaceId_address: { interfaceId: parentInterfaceId, address: addr.address } },
            update: { comment: addr.comentario ?? null },
            create: {
              interfaceId: parentInterfaceId,
              address: addr.address,
              comment: addr.comentario ?? null,
            },
          });
          savedIpAddresses.push(ipRow);
        }

        // 3) salva rotas em vcn_mkt (schema exige tudo obrigatório)
        const savedRoutes = [];
        for (const r of parsedRoutes) {
          // sem campos obrigatórios, não persiste (mas segue o baile)
          if (!r.dstAddress || !r.gateway || !r.distance) continue;

          const row = await tx.vcn_mkt.upsert({
            where: {
              ip_vcn_dst_gateway_distance: {
                ip: r.ip,
                vcn: r.vcn,
                dstAddress: r.dstAddress,
                gateway: r.gateway,
                distance: String(r.distance),
              },
            },
            update: {
              gatewayStatus: r.gatewayStatus ?? null,
              comentario: r.comentario ?? null,
              active: Boolean(r.active),
              scanId,
            },
            create: {
              vcn: r.vcn,
              ip: r.ip,
              dstAddress: r.dstAddress,
              gateway: r.gateway,
              gatewayStatus: r.gatewayStatus ?? null,
              distance: String(r.distance),
              comentario: r.comentario ?? null,
              active: Boolean(r.active),
              scanId,
            },
          });

          savedRoutes.push(row);
        }

        return {
          scanId,
          interfacesParsed: parsedIfaces.length,
          routesParsed: parsedRoutes.length,
          interfacesSaved: savedIfaces.length,
          ipAddressesSaved: savedIpAddresses.length,
          routesSaved: savedRoutes.length,
        };
      });

      const finalResult = {
        ok: true,
        ...result,
        garyPartner,
        planktonPartner,
        routes: parsedRoutes, // Adiciona as rotas parseadas à resposta
      };

      console.log("Scan successful:", JSON.stringify(finalResult, null, 2));

      return res.json(finalResult);
    } catch (e) {
      console.error("Scan failed:", e);
      return res.status(500).json({ ok: false, error: e.message, details: fullStderr });
    }
  });
});

// ======================================================
// Página principal (front)
// ======================================================


// ======================================================
// Lista de comandos (DB)
// ======================================================
router.get("/commands", async (req, res) => {
  try {
    const commands = await prisma.commands_mkt.findMany();
    res.json(commands);
  } catch (error) {
    console.error("Erro ao buscar comandos:", error);
    res.status(500).json({ error: "Falha ao buscar comandos do banco de dados." });
  }
});

// ======================================================
// Endpoint: run (stream em tempo real pro front)
// - Filtra logs python pelo regex de nível
// ======================================================
router.post("/run", (req, res) => {
  const { ip, command } = req.body;

  if (!ip || !command) {
    return res.status(400).send("IP e Comando são obrigatórios");
  }

  const scriptPath = path.join(__dirname, "..", "scripts", "comandosMkt.py");
  const args = [scriptPath, ip, command];
  const py = spawn(PY_CMD, args, SPAWN_OPTS);

  res.setHeader("Content-Type", "text/plain; charset=utf-8");

  let stdoutBuf = "";
  let stderrBuf = "";

  // logs “padrão” do python
  const logRegex = /\s-\s(INFO|ERROR|DEBUG|WARNING)\s-\s/;

  py.stdout.on("data", (data) => {
    stdoutBuf += data.toString("utf-8");
    let idx;
    while ((idx = stdoutBuf.indexOf("\n")) >= 0) {
      const line = stdoutBuf.slice(0, idx).replace(/\r$/, "");
      stdoutBuf = stdoutBuf.slice(idx + 1);

      if (logRegex.test(line)) {
        console.log(`[Python LOG] ${line}`);
      } else {
        res.write(line + "\n");
      }
    }
  });

  py.stderr.on("data", (data) => {
    stderrBuf += data.toString("utf-8");
    let idx;
    while ((idx = stderrBuf.indexOf("\n")) >= 0) {
      const line = stderrBuf.slice(0, idx).replace(/\r$/, "");
      stderrBuf = stderrBuf.slice(idx + 1);

      if (logRegex.test(line)) {
        console.log(`[Python LOG] ${line}`);
      } else {
        console.error(`[Python STDERR] ${line}`);
        res.write(`[ERRO] ${line}\n`);
      }
    }
  });

  py.on("close", (code) => {
    // flush buffers
    if (stdoutBuf.trim()) {
      const line = stdoutBuf.trim();
      if (!logRegex.test(line)) res.write(line + "\n");
      else console.log(`[Python LOG] ${line}`);
    }

    if (stderrBuf.trim()) {
      const line = stderrBuf.trim();
      if (!logRegex.test(line)) {
        console.error(`[Python STDERR] ${line}`);
        res.write(`[ERRO] ${line}\n`);
      } else {
        console.log(`[Python LOG] ${line}`);
      }
    }

    if (code !== 0) {
      const finalMessage = `\nScript finalizado com código de erro ${code}\n`;
      console.error(finalMessage.trim());
      res.write(finalMessage);
    }

    res.end();
  });
});

export default router;
