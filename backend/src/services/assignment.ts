import { supabase } from '../config/supabase.js';

// TypeScript interface defining exactly what the frontend expects
export interface AssignmentFrontend {
  id: string;
  title: string;
  course: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in-progress' | 'done';
  createdAt: string;
}

// Map Database row (snake_case) to Frontend object (camelCase)
function mapToFrontend(row: any): AssignmentFrontend {
  return {
    id: row.id,
    title: row.title,
    course: row.subject,      // mapped
    description: row.description,
    dueDate: row.deadline,    // mapped
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at // mapped
  };
}

export const assignmentService = {
  async getAssignments(userId: string): Promise<AssignmentFrontend[]> {
    console.log('[DEBUG] Fetching assignments for user_id:', userId);

    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('[DEBUG] GET assignments error:', error);
      throw error;
    }

    console.log('[DEBUG] Fetched assignments count:', data?.length ?? 0);
    return (data || []).map(mapToFrontend);
  },

  async createAssignment(userId: string, assignment: Omit<AssignmentFrontend, 'id' | 'createdAt'>): Promise<AssignmentFrontend> {
    const dbPayload = {
      user_id: userId,        // ALWAYS injected from JWT, never from frontend
      title: assignment.title,
      subject: assignment.course,     // mapped
      description: assignment.description,
      deadline: assignment.dueDate || null,   // Map empty string to null for Postgres DATE
      priority: assignment.priority,
      status: assignment.status
    };

    console.log('[DEBUG] Creating assignment for user_id:', userId);
    console.log('[DEBUG] INSERT payload:', dbPayload);

    const { data, error } = await supabase
      .from('assignments')
      .insert(dbPayload)
      .select('*')
      .single();

    if (error) {
      console.error('[DEBUG] INSERT assignment error:', error);
      throw error;
    }

    console.log('[DEBUG] Inserted assignment:', data);
    return mapToFrontend(data);
  },

  async updateAssignment(userId: string, id: string, updates: Partial<AssignmentFrontend>): Promise<AssignmentFrontend> {
    const dbPayload: any = {};
    if (updates.title !== undefined) dbPayload.title = updates.title;
    if (updates.course !== undefined) dbPayload.subject = updates.course; // mapped
    if (updates.description !== undefined) dbPayload.description = updates.description;
    if (updates.dueDate !== undefined) dbPayload.deadline = updates.dueDate || null; // mapped
    if (updates.priority !== undefined) dbPayload.priority = updates.priority;
    if (updates.status !== undefined) dbPayload.status = updates.status;

    console.log('[DEBUG] Updating assignment id:', id, 'for user_id:', userId);

    const { data, error } = await supabase
      .from('assignments')
      .update(dbPayload)
      .eq('id', id)
      .eq('user_id', userId) // ENFORCE OWNERSHIP
      .select('*')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error("Assignment not found or you don't have permission to update it.");
      }
      console.error('[DEBUG] UPDATE assignment error:', error);
      throw error;
    }
    
    console.log('[DEBUG] Updated assignment:', data);
    return mapToFrontend(data);
  },

  async deleteAssignment(userId: string, id: string): Promise<void> {
    console.log('[DEBUG] Deleting assignment id:', id, 'for user_id:', userId);

    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', id)
      .eq('user_id', userId); // ENFORCE OWNERSHIP

    if (error) {
      console.error('[DEBUG] DELETE assignment error:', error);
      throw error;
    }

    console.log('[DEBUG] Assignment deleted successfully');
  }
};
