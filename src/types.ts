export interface Student {
  id: string;
  email: string;
  name?: string;
  startDate: string;
  accessExpiresAt: string;
  currentWeek: number;
  daysRemaining: number;
  status: 'active' | 'expired' | 'inactive';
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  accessLevel: number;
}

export interface DashboardMetrics {
  totalStudents: number;
  activeStudents: number;
  expiredStudents: number;
  inactiveStudents: number;
  byWeek: Array<{ week: number; count: number }>;
  recentAdditions: Student[];
}

export interface CreateStudentRequest {
  email: string;
  name?: string;
  startDate: string;
  accessLevel?: number;
}

export interface UpdateStudentRequest {
  name?: string;
  isActive?: boolean;
  resetPassword?: boolean;
  accessLevel?: number;
}
