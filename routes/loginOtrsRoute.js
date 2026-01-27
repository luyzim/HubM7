import axios from "axios";
import express from "express";
import { PrismaClient } from "@prisma/client";


const router = express.Router();
const prisma = new PrismaClient();

router.post("/", async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: "Login e senha são obrigatórios." });
  }

  const zuniyPayload = {
    UserLogin: login,
    Password: password,
  };

  try{
    const response = await axios.post('http://172.16.0.12/znuny/nph-genericinterface.pl/Webservice/GenericTicketConnectorREST/Session', 
      zuniyPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout : 5000,
    });
  

  const {SessionID} = response.data || {};
  
  if(!SessionID){
    return res.status(502).json({ error: "Falha ao autenticar com o Znuny: resposta inválida." });
  }


  return res.status(200).json({
      message: "Autenticação realizada com sucesso.",
      sessionId: SessionID
  });
  
  }  catch(err){
    if (err.code === "ECONNABORTED" || err.code === "ENETUNREACH") {
      return res.status(504).json({
        error: "Timeout ou falha de conexão com o Znuny."
      });
    }

    if (status === 401 || status === 403) {
        return res.status(401).json({
          error: "Credenciais inválidas para o Znuny."
        });
      }
    return res.status(502).json({
      error: "Erro ao comunicar com o Znuny.",
      details: err.message || null
    });
  }
  
  
});
export default router;
