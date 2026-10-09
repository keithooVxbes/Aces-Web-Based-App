import { supabase } from '../config/supabase.js';

export interface ScheduleClassFrontend {
  id: string;
  name: string;
  room: string;
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  colorTheme: string;
}

// Helper to normalize frontend HH:MM to backend TIME format HH:MM:00
function normalizeToTime(timeStr: string): string {
  if (!timeStr) return '00:00:00';
  if (timeStr.length === 5) return `${timeStr}:00`;
  return timeStr;
}

// Helper to truncate backend TIME HH:MM:00 to frontend HH:MM
function truncateToTime(timeStr: string): string {
  if (!timeStr) return '00:00';
  return timeStr.substring(0, 5);
}

export const scheduleService = {
  async getSchedules(userId: string): Promise<ScheduleClassFrontend[]> {
    console.log(`[DEBUG][Service] getSchedules - user: ${userId}`);
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('[DEBUG][Service] getSchedules Error:', error);
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      name: row.class_name,
      room: row.location || '',
      day: row.day,
      startTime: truncateToTime(row.start_time),
      endTime: truncateToTime(row.end_time),
      colorTheme: row.color_theme || 'default'
    }));
  },

  async createSchedule(userId: string, cls: ScheduleClassFrontend): Promise<ScheduleClassFrontend> {
    console.log(`[DEBUG][Service] createSchedule - user: ${userId}, class:`, cls);
    
    const startTimeDb = normalizeToTime(cls.startTime);
    const endTimeDb = normalizeToTime(cls.endTime);

    // Overlap Validation
    // Formula: (existing_start < new_end) AND (existing_end > new_start)
    const { data: overlaps, error: overlapError } = await supabase
      .from('schedules')
      .select('id')
      .eq('user_id', userId)
      .eq('day', cls.day)
      .lt('start_time', endTimeDb)
      .gt('end_time', startTimeDb);

    if (overlapError) throw overlapError;
    if (overlaps && overlaps.length > 0) {
      throw new Error('Schedule overlaps with existing schedule');
    }

    const dbPayload = {
      id: cls.id, // Frontend UUID
      user_id: userId,
      class_name: cls.name,
      location: cls.room || null,
      day: cls.day,
      start_time: startTimeDb,
      end_time: endTimeDb,
      color_theme: cls.colorTheme || 'default'
    };

    const { data, error } = await supabase
      .from('schedules')
      .insert(dbPayload)
      .select()
      .single();

    if (error) {
      console.error('[DEBUG][Service] createSchedule Error:', error);
      throw error;
    }

    return {
      id: data.id,
      name: data.class_name,
      room: data.location || '',
      day: data.day,
      startTime: truncateToTime(data.start_time),
      endTime: truncateToTime(data.end_time),
      colorTheme: data.color_theme || 'default'
    };
  },

  async updateSchedule(userId: string, id: string, updates: Partial<ScheduleClassFrontend>): Promise<void> {
    console.log(`[DEBUG][Service] updateSchedule - user: ${userId}, id: ${id}`);
    
    // Fetch existing schedule first to correctly evaluate overlap if day or times changed
    const { data: current, error: getError } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (getError) throw getError;
    if (!current) throw new Error('Schedule not found');

    const checkDay = updates.day !== undefined ? updates.day : current.day;
    const checkStartTime = updates.startTime !== undefined ? normalizeToTime(updates.startTime) : current.start_time;
    const checkEndTime = updates.endTime !== undefined ? normalizeToTime(updates.endTime) : current.end_time;

    // Overlap Validation for update
    if (updates.day || updates.startTime || updates.endTime) {
      const { data: overlaps, error: overlapError } = await supabase
        .from('schedules')
        .select('id')
        .eq('user_id', userId)
        .eq('day', checkDay)
        .neq('id', id) // Ignore self
        .lt('start_time', checkEndTime)
        .gt('end_time', checkStartTime);
        
      if (overlapError) throw overlapError;
      if (overlaps && overlaps.length > 0) {
        throw new Error('Schedule overlaps with existing schedule');
      }
    }

    const dbPayload: any = {};
    if (updates.name !== undefined) dbPayload.class_name = updates.name;
    if (updates.room !== undefined) dbPayload.location = updates.room || null;
    if (updates.day !== undefined) dbPayload.day = updates.day;
    if (updates.startTime !== undefined) dbPayload.start_time = normalizeToTime(updates.startTime);
    if (updates.endTime !== undefined) dbPayload.end_time = normalizeToTime(updates.endTime);
    if (updates.colorTheme !== undefined) dbPayload.color_theme = updates.colorTheme || 'default';

    const { error } = await supabase
      .from('schedules')
      .update(dbPayload)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[DEBUG][Service] updateSchedule Error:', error);
      throw error;
    }
  },

  async deleteSchedule(userId: string, id: string): Promise<void> {
    console.log(`[DEBUG][Service] deleteSchedule - user: ${userId}, id: ${id}`);
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error('[DEBUG][Service] deleteSchedule Error:', error);
      throw error;
    }
  }
};
