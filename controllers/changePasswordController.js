import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const { id: userId, role } = req.session.user;

    let userModel;
    switch (role) {
        case 'admin':
            userModel = prisma.admins;
            break;
        case 'n2':
            userModel = prisma.n2;
            break;
        case 'n1':
            userModel = prisma.n1;
            break;
        case 'monitoring':
            userModel = prisma.monitoramento;
            break;
        default:
            return res.status(400).json({ message: 'Invalid user role' });
    }

    try {
        const user = await userModel.findUnique({ where: { id: userId } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.pass_hash);

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid old password' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await userModel.update({
            where: { id: userId },
            data: { pass_hash: hashedPassword },
        });

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export default {
    changePassword,
};

