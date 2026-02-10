import express from 'express';
import path from 'path';
import { exec, spawn } from 'child_process';
import morgan from 'morgan';
import fs from 'fs';
import { fileURLToPath } from "url";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


router.use(express.json());



router.post('/', (req, res) => {
    const { group, identifier, ips } = req.body;

    if (!group || !identifier || !ips) {
        return res.status(400).json({ error: 'Dados incompletos.' });
    }

    // Collect all IPs in the correct order
    const ipList = [
        ips.internet.mkt,
        ips.internet.gary,
        ips.internet.plankton,
        ips.internet.wan,
        ips.internet.lan,
        ips.mpls.mkt,
        ips.mpls.gary,
        ips.mpls.plankton,
        ips.mpls.wan,
        ips.mpls.lan,
    ];
    // Sanitize inputs to prevent command injection
    const sanitizedGroup = JSON.stringify(group);
    const sanitizedIdentifier = JSON.stringify(identifier);
    const sanitizedIps = ipList.map(ip => JSON.stringify(ip)).join(' ');

    const scriptPath = path.join(__dirname, "..", "scripts", "createHostCcs.py");
    const command = `python "${scriptPath}" ${sanitizedGroup} ${sanitizedIdentifier} ${sanitizedIps}`;
  

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Exec error: ${error}`);
            // Try to parse stderr for a more specific error from the script
            try {
                const errorJson = JSON.parse(stderr);
                return res.status(500).json(errorJson);
            } catch (e) {
                return res.status(500).json({ error: 'Erro ao executar o script.', details: stderr });
            }
        }

        try {
            const results = JSON.parse(stdout);
            res.json(results);
            console.log("Criado Hosts para", group, identifier);
        } catch (e) {
            res.status(500).json({ error: 'Erro ao processar a resposta do script.', details: stdout });
        }
     });
});

export default router;