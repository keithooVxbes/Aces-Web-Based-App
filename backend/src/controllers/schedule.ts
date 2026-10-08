import { Request, Response, NextFunction } from 'express';
import { scheduleService } from '../services/schedule';

export const getSchedules = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedules = await scheduleService.getSchedules(req.user!.id);
    res.json(schedules);
  } catch (error) { next(error); }
};

export const createSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedule = await scheduleService.createSchedule(req.user!.id, req.body);
    res.status(201).json(schedule);
  } catch (error: any) { 
    if (error.message === 'Schedule overlaps with existing schedule') {
      res.status(409).json({ error: error.message });
      return;
    }
    next(error); 
  }
};

export const updateSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await scheduleService.updateSchedule(req.user!.id, req.params.id, req.body);
    res.json({ success: true });
  } catch (error: any) { 
    if (error.message === 'Schedule overlaps with existing schedule') {
      res.status(409).json({ error: error.message });
      return;
    }
    next(error); 
  }
};

export const deleteSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await scheduleService.deleteSchedule(req.user!.id, req.params.id);
    res.json({ success: true });
  } catch (error) { next(error); }
};
