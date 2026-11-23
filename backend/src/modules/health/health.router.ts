import { publicProcedure } from '#core/rpc/procedures'
import * as healthService from './health.service.js'

// Routes + controller layer: auth, input validation -> service -> result. No business logic here.
export const healthRouter = {
  // Is the API up, and can it reach the database?
  check: publicProcedure.handler(() => healthService.check()),
}
