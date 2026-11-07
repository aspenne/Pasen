import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Lets an admin through and nobody else. Runs after the auth middleware, so
 * by then there is a user: a member is signed in, and is refused with a 403
 * rather than asked to sign in again.
 */
export default class AdminMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (ctx.auth.user?.role !== 'admin') {
      return ctx.response.forbidden({ message: 'This needs an admin.' })
    }
    return next()
  }
}
