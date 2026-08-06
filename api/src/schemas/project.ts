import { z } from 'zod'

export const projectStatus = z.enum([
  'active',
  'paused',
  'completed',
  'archived',
])

export const createProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: projectStatus.optional(),
  startDate: z.string().optional(),
  targetDate: z.string().optional(),
  color: z.string().optional(),
  sortOrder: z.number().int().optional(),
})

export const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: projectStatus.optional(),
  startDate: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
})

export const listProjectsQuerySchema = z.object({
  status: projectStatus.optional(),
})
