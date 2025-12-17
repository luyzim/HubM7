import express from 'express';
import path from 'path';
import { exec } from 'child_process';
import morgan from 'morgan';
import fs from 'fs';
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// --- Logging Setup ---
// Create a write stream (in append mode)
const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' });

// Log to console with the 'common' format
app.use(morgan('common'));
// Log to file with the 'common' format (similar to Flask/Apache)
app.use(morgan('common', { stream: accessLogStream }));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/create-hosts', (req, res) => {
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

    const scriptPath = path.join(__dirname, 'ZabbixAPI', 'create_hots_hosts.py');
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
        } catch (e) {
            res.status(500).json({ error: 'Erro ao processar a resposta do script.', details: stdout });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
