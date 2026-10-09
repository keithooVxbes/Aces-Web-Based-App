import { Request, Response, NextFunction } from 'express';
import { profileService } from '../services/profile.js';

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const profile = await profileService.getProfile(userId);
    res.json(profile);
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    const updatedProfile = await profileService.updateProfile(userId, req.body);
    res.json(updatedProfile);
  } catch (error) {
    next(error);
  }
};
