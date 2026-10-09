import { supabase } from '../config/supabase.js';

// Frontend Interfaces
export interface NoteFrontend {
  id: string;
  content: string;
  lastModified: number;
  pinned: boolean;
  folderId: string | null;
}

export interface NoteFolderFrontend {
  id: string;
  name: string;
  createdAt: number;
}

// Extract title from content
function extractTitle(content: string): string {
  if (!content) return "Untitled";
  const lines = content.split('\n');
  const firstLine = lines.find(line => line.trim().length > 0);
  
  if (firstLine) {
    return firstLine.substring(0, 50).trim();
  }
  return "Untitled";
}

export const noteService = {
  // --- FOLDERS ---
  async getFolders(userId: string): Promise<NoteFolderFrontend[]> {
    const { data, error } = await supabase
      .from('note_folders')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      createdAt: new Date(row.created_at).getTime()
    }));
  },

  async createFolder(userId: string, folder: NoteFolderFrontend): Promise<NoteFolderFrontend> {
    const dbPayload = {
      id: folder.id, // allow frontend to send ID for optimistic UI mapping
      user_id: userId,
      name: folder.name,
      position: 0,
      created_at: new Date(folder.createdAt).toISOString()
    };

    const { data, error } = await supabase
      .from('note_folders')
      .insert(dbPayload)
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      name: data.name,
      createdAt: new Date(data.created_at).getTime()
    };
  },

  async updateFolder(userId: string, id: string, name: string): Promise<void> {
    const { error } = await supabase
      .from('note_folders')
      .update({ name })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async deleteFolder(userId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('note_folders')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async deleteFolderAndNotes(userId: string, id: string): Promise<void> {
    // Delete notes first
    const { error: notesError } = await supabase
      .from('notes')
      .delete()
      .eq('folder_id', id)
      .eq('user_id', userId);
    
    if (notesError) throw notesError;

    // Delete folder
    const { error: folderError } = await supabase
      .from('note_folders')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (folderError) throw folderError;
  },

  // --- NOTES ---
  async getNotes(userId: string): Promise<NoteFrontend[]> {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('position', { ascending: true })
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      content: row.content || "",
      lastModified: new Date(row.updated_at).getTime(),
      pinned: row.is_pinned,
      folderId: row.folder_id
    }));
  },

  async createNote(userId: string, note: NoteFrontend): Promise<NoteFrontend> {
    const title = extractTitle(note.content);
    
    const dbPayload = {
      id: note.id,
      user_id: userId,
      folder_id: note.folderId,
      title: title,
      content: note.content,
      is_pinned: note.pinned,
      position: 0,
      updated_at: new Date(note.lastModified).toISOString()
    };

    const { data, error } = await supabase
      .from('notes')
      .insert(dbPayload)
      .select()
      .single();

    if (error) throw error;
    
    return {
      id: data.id,
      content: data.content || "",
      lastModified: new Date(data.updated_at).getTime(),
      pinned: data.is_pinned,
      folderId: data.folder_id
    };
  },

  async updateNote(userId: string, id: string, updates: Partial<NoteFrontend>): Promise<void> {
    const dbPayload: any = {};
    
    if (updates.content !== undefined) {
      dbPayload.content = updates.content;
      dbPayload.title = extractTitle(updates.content);
    }
    if (updates.pinned !== undefined) dbPayload.is_pinned = updates.pinned;
    if (updates.folderId !== undefined) dbPayload.folder_id = updates.folderId;
    if (updates.lastModified !== undefined) dbPayload.updated_at = new Date(updates.lastModified).toISOString();

    const { error } = await supabase
      .from('notes')
      .update(dbPayload)
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async deleteNote(userId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async deleteNotes(userId: string, ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    
    const { error } = await supabase
      .from('notes')
      .delete()
      .in('id', ids)
      .eq('user_id', userId);

    if (error) throw error;
  },

  // --- REORDERING ---
  async reorderNotes(userId: string, orderedIds: string[]): Promise<void> {
    if (!orderedIds || orderedIds.length === 0) return;

    // Ideally, we'd use a bulk update. Supabase pg-graphql or rpc can do it.
    // For now, we will perform sequential updates, since the list is small.
    // An alternative is using upsert.
    const updates = orderedIds.map((id, index) => ({
      id,
      user_id: userId,
      position: index
    }));

    // Upsert requires all non-null columns if creating, but for update it might need them.
    // We'll update sequentially to be safe with RLS and schema.
    for (const update of updates) {
      const { error } = await supabase
        .from('notes')
        .update({ position: update.position })
        .eq('id', update.id)
        .eq('user_id', userId);
        
      if (error) console.error("Error updating note position:", error);
    }
  }
};
