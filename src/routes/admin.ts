import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { verifyAdminToken, type AuthRequest } from '../middleware/auth';
import * as studentService from '../services/studentService';

const router = Router();

// POST /api/admin/login
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Senha obrigatória' });
    }
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Senha inválida' });
    }

    const token = jwt.sign({ adminId: 'admin' }, process.env.JWT_SECRET!, { expiresIn: '24h' });
    res.json({ token, expiresIn: 86400 });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /api/admin/students
router.get('/students', verifyAdminToken, async (req: AuthRequest, res) => {
  try {
    const status = req.query.status as string | undefined;
    const students = await studentService.getStudents({ status });
    res.json(students);
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Falha ao buscar alunos' });
  }
});

// POST /api/admin/students
router.post('/students', verifyAdminToken, async (req: AuthRequest, res) => {
  try {
    const { email, name, startDate, accessLevel } = req.body;
    if (!email || !startDate) {
      return res.status(400).json({ error: 'Email e data de início são obrigatórios' });
    }

    const student = await studentService.createStudent({ email, name, startDate, accessLevel });
    res.status(201).json(student);
  } catch (error) {
    console.error('Create student error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// PATCH /api/admin/students/:id
router.patch('/students/:id', verifyAdminToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const student = await studentService.updateStudent(id, updates);
    res.json(student);
  } catch (error) {
    console.error('Update student error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// DELETE /api/admin/students/:id
router.delete('/students/:id', verifyAdminToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await studentService.deleteStudent(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// GET /api/admin/dashboard
router.get('/dashboard', verifyAdminToken, async (_req, res) => {
  try {
    const metrics = await studentService.getDashboardMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Falha ao buscar métricas' });
  }
});

export default router;
