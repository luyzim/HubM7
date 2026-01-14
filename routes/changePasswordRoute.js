import express from 'express';
import changePasswordController from '../controllers/changePasswordController.js';

const router = express.Router();

// A rota POST é acionada pela submissão do formulário.
// O middleware de autenticação (ensureN1) já é aplicado em server.js.
router.post('/', changePasswordController.changePassword);

export default router;
