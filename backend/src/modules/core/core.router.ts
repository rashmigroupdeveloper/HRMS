/**
 * Core Organization Masters Router (CORE-01, LC-05).
 *
 * Provides authenticated master list catalog for:
 * - Legal entities (companies)
 * - Departments
 * - Locations & Plants
 * - Designations
 * - Grades
 */

import { z } from 'zod';
import { authed } from '../../api/orpc.js';

const companyItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string(),
  ecode_prefix: z.string(),
});

const departmentItemSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const locationItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  state_code: z.string().optional(),
});

const designationItemSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const gradeItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string(),
  rank: z.number(),
});

export const coreRouter = {
  /** List all legal entities (companies) in the group */
  companies: authed
    .route({
      method: 'GET',
      path: '/core/companies',
      summary: 'List canonical company legal entities',
    })
    .input(z.object({}).optional())
    .output(z.object({ companies: z.array(companyItemSchema) }))
    .handler(async ({ context }) => {
      const rows = await context.db
        .selectFrom('core.companies')
        .select(['id', 'name', 'code', 'ecode_prefix'])
        .orderBy('name', 'asc')
        .execute();
      return { companies: rows };
    }),

  /** List all departments */
  departments: authed
    .route({
      method: 'GET',
      path: '/core/departments',
      summary: 'List corporate and plant departments',
    })
    .input(z.object({}).optional())
    .output(z.object({ departments: z.array(departmentItemSchema) }))
    .handler(async ({ context }) => {
      const rows = await context.db
        .selectFrom('core.departments')
        .select(['id', 'name'])
        .orderBy('name', 'asc')
        .execute();
      return { departments: rows };
    }),

  /** List all office and plant locations */
  locations: authed
    .route({
      method: 'GET',
      path: '/core/locations',
      summary: 'List office and manufacturing plant locations',
    })
    .input(z.object({}).optional())
    .output(z.object({ locations: z.array(locationItemSchema) }))
    .handler(async ({ context }) => {
      const rows = await context.db
        .selectFrom('core.locations')
        .select(['id', 'name', 'state_code'])
        .orderBy('name', 'asc')
        .execute();
      return {
        locations: rows.map((r) => ({
          id: r.id,
          name: r.name,
          state_code: r.state_code,
        })),
      };
    }),

  /** List all job designations */
  designations: authed
    .route({
      method: 'GET',
      path: '/core/designations',
      summary: 'List standard job designations',
    })
    .input(z.object({}).optional())
    .output(z.object({ designations: z.array(designationItemSchema) }))
    .handler(async ({ context }) => {
      const rows = await context.db
        .selectFrom('core.designations')
        .select(['id', 'name'])
        .orderBy('name', 'asc')
        .execute();
      return { designations: rows };
    }),

  /** List all job grades */
  grades: authed
    .route({
      method: 'GET',
      path: '/core/grades',
      summary: 'List job grades and hierarchy ranks',
    })
    .input(z.object({}).optional())
    .output(z.object({ grades: z.array(gradeItemSchema) }))
    .handler(async ({ context }) => {
      const rows = await context.db
        .selectFrom('core.grades')
        .select(['id', 'name', 'code', 'rank'])
        .orderBy('rank', 'asc')
        .execute();
      return { grades: rows };
    }),
};
