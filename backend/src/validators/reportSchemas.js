const { z } = require('zod');

const uuid = z.string().uuid();
const status = z.enum(['draft', 'submitted', 'assigned', 'in_progress', 'resolved', 'rejected']);
const priority = z.enum(['low', 'medium', 'high', 'critical']);

const location = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
  landmark: z.string().trim().max(500).optional(),
  source: z.enum(['gps', 'manual'])
});

const reportPayload = z.object({
  id: uuid,
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(5000),
  location,
  priority,
  status: status.default('submitted'),
  clientUpdatedAt: z.string().datetime({ offset: true }).optional()
});

const syncItem = z.object({
  id: uuid,
  operation: z.enum(['create', 'upsert']).default('upsert'),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(5000),
  location,
  priority,
  status: status,
  clientUpdatedAt: z.string().datetime({ offset: true }).optional()
});

const syncRequest = z.object({
  items: z.array(syncItem).min(1).max(50)
});

const listQuery = z.object({
  status: z.string().optional().transform((value) => value ? value.split(',') : undefined)
    .pipe(z.array(status).optional()),
  priority: priority.optional(),
  category: z.string().trim().min(1).max(100).optional(),
  createdFrom: z.string().datetime({ offset: true }).optional(),
  createdTo: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

const transitionRequest = z.object({
  newStatus: status,
  expectedStatus: status,
  reason: z.string().trim().max(2000).optional(),
  assignee: z.string().trim().max(200).optional()
});

module.exports = {
  reportPayload,
  syncRequest,
  listQuery,
  transitionRequest
};
