import { createClient } from '@supabase/supabase-js';
import type { Student, DashboardMetrics, CreateStudentRequest, UpdateStudentRequest } from '../types';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createStudent(data: CreateStudentRequest): Promise<Student> {
  const tempPassword = generatePassword();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: data.email,
    password: tempPassword,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    throw new Error(`Falha ao criar usuário: ${authError?.message}`);
  }

  const startDate = new Date(data.startDate);
  const accessExpiresAt = new Date(startDate);
  accessExpiresAt.setDate(accessExpiresAt.getDate() + 365);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: authData.user.id,
      email: data.email,
      name: data.name || null,
      start_date: data.startDate,
      access_expires_at: accessExpiresAt.toISOString().split('T')[0],
      must_change_password: true,
      is_active: true,
      access_level: data.accessLevel ?? 1,
    })
    .select()
    .single();

  if (profileError || !profile) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw new Error(`Falha ao criar perfil: ${profileError?.message}`);
  }

  return formatStudent(profile);
}

export async function getStudents(filters?: { status?: string }): Promise<Student[]> {
  let query = supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status !== 'all') {
    const now = new Date().toISOString().split('T')[0];
    if (filters.status === 'active') {
      query = query.eq('is_active', true).gt('access_expires_at', now);
    } else if (filters.status === 'expired') {
      query = query.lte('access_expires_at', now);
    } else if (filters.status === 'inactive') {
      query = query.eq('is_active', false);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`Falha ao buscar alunos: ${error.message}`);

  return data.map(formatStudent);
}

export async function updateStudent(
  studentId: string,
  updates: UpdateStudentRequest
): Promise<Student> {
  const updateData: Record<string, unknown> = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
  if (updates.resetPassword) updateData.must_change_password = true;
  if (updates.accessLevel !== undefined) updateData.access_level = updates.accessLevel;

  const { data: profile, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', studentId)
    .select()
    .single();

  if (error || !profile) throw new Error(`Falha ao atualizar perfil: ${error?.message}`);

  return formatStudent(profile);
}

export async function deleteStudent(studentId: string): Promise<void> {
  const { error: profileError } = await supabase
    .from('profiles')
    .delete()
    .eq('id', studentId);

  if (profileError) throw new Error(`Falha ao deletar perfil: ${profileError.message}`);

  const { error: authError } = await supabase.auth.admin.deleteUser(studentId);
  if (authError) throw new Error(`Falha ao deletar usuário: ${authError.message}`);
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Falha ao buscar métricas: ${error.message}`);

  const now = new Date();
  const nowString = now.toISOString().split('T')[0];

  const metrics: DashboardMetrics = {
    totalStudents: data.length,
    activeStudents: 0,
    expiredStudents: 0,
    inactiveStudents: 0,
    byWeek: Array(12).fill(0).map((_, i) => ({ week: i + 1, count: 0 })),
    recentAdditions: [],
  };

  data.forEach((profile: Record<string, unknown>) => {
    if (!profile.is_active) {
      metrics.inactiveStudents++;
    } else if ((profile.access_expires_at as string) < nowString) {
      metrics.expiredStudents++;
    } else {
      metrics.activeStudents++;
    }

    const startDate = new Date(profile.start_date as string);
    const daysDiff = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const week = Math.min(Math.floor(daysDiff / 7) + 1, 12);
    metrics.byWeek[week - 1].count++;
  });

  metrics.recentAdditions = data.slice(0, 5).map(formatStudent);

  return metrics;
}

function formatStudent(profile: Record<string, unknown>): Student {
  const now = new Date();
  const nowString = now.toISOString().split('T')[0];
  const startDate = new Date(profile.start_date as string);
  const daysDiff = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const currentWeek = Math.min(Math.floor(daysDiff / 7) + 1, 12);

  const expiresAt = new Date(profile.access_expires_at as string);
  const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  let status: 'active' | 'expired' | 'inactive' = 'active';
  if (!profile.is_active) {
    status = 'inactive';
  } else if ((profile.access_expires_at as string) <= nowString) {
    status = 'expired';
  }

  return {
    id: profile.id as string,
    email: profile.email as string,
    name: profile.name as string | undefined,
    startDate: profile.start_date as string,
    accessExpiresAt: profile.access_expires_at as string,
    currentWeek,
    daysRemaining: Math.max(daysRemaining, 0),
    status,
    isActive: profile.is_active as boolean,
    mustChangePassword: profile.must_change_password as boolean,
    createdAt: profile.created_at as string,
    accessLevel: (profile.access_level as number) ?? 1,
  };
}

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let pwd = '';
  for (let i = 0; i < length; i++) {
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pwd;
}
