import { z } from 'zod';

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:MM

export const createScheduleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Class name is required").max(100),
  room: z.string().max(100).optional().default(''),
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
  startTime: z.string().regex(timeRegex, "Start time must be in HH:MM format"),
  endTime: z.string().regex(timeRegex, "End time must be in HH:MM format"),
  colorTheme: z.string().optional()
}).refine(data => {
  return data.startTime < data.endTime;
}, {
  message: "End time must be greater than start time",
  path: ["endTime"]
});

export const updateScheduleSchema = z.object({
  name: z.string().min(1, "Class name is required").max(100).optional(),
  room: z.string().max(100).optional(),
  day: z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']).optional(),
  startTime: z.string().regex(timeRegex, "Start time must be in HH:MM format").optional(),
  endTime: z.string().regex(timeRegex, "End time must be in HH:MM format").optional(),
  colorTheme: z.string().optional()
}).refine(data => {
  if (data.startTime && data.endTime) {
    return data.startTime < data.endTime;
  }
  return true;
}, {
  message: "End time must be greater than start time",
  path: ["endTime"]
});
