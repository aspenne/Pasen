import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

import User from '#models/user'

const credentials = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    password: vine.string().minLength(8),
  })
)

export default class SessionController {
  /** Who is signed in, for the admin UI to decide what to render. */
  async show({ auth }: HttpContext) {
    // Read the user off the guard, not off `auth`: check() resolves it on the
    // guard instance, and `auth.user` is only populated by the middleware.
    const guard = auth.use('web')
    const authenticated = await guard.check()

    return { authenticated, email: guard.user?.email ?? null }
  }

  async store({ request, response, auth }: HttpContext) {
    const { email, password } = await credentials.validate(request.all())

    /*
     * verifyCredentials hashes the supplied password even when the email is
     * unknown, so a wrong address and a wrong password take the same time, and
     * both come back as the same error. Anything else tells an attacker which
     * addresses exist.
     */
    const user = await User.verifyCredentials(email, password)
    await auth.use('web').login(user)

    return response.created({ email: user.email })
  }

  async destroy({ auth, response }: HttpContext) {
    await auth.use('web').logout()
    return response.noContent()
  }
}
