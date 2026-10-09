import { supabase } from '../config/supabase.js';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  bio: string | null;
  avatar_url: string | null;
}

export const profileService = {
  async getProfile(userId: string): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, bio, avatar_url')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }

    return data;
  },

  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const dbPayload: any = {};
    if (updates.username !== undefined) dbPayload.username = updates.username;
    if (updates.bio !== undefined) dbPayload.bio = updates.bio;
    if (updates.avatar_url !== undefined) dbPayload.avatar_url = updates.avatar_url;

    // Never allow updating id or email through this profile route
    
    const { data, error } = await supabase
      .from('users')
      .update(dbPayload)
      .eq('id', userId)
      .select('id, username, email, bio, avatar_url')
      .single();

    if (error) {
      throw error;
    }

    return data;
  }
};
