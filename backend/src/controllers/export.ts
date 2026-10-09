import { Request, Response, NextFunction } from 'express';
import { exportService } from '../services/export.js';

export const getExportData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const data = await exportService.exportUserData(userId);

    const exportPayload = {
      backup_version: "1.0",
      exported_at: new Date().toISOString(),
      application: "ACES",
      user: {
        id: userId,
        email: req.user!.email || null
      },
      data: data
    };

    res.json(exportPayload);
  } catch (error) {
    next(error);
  }
};
