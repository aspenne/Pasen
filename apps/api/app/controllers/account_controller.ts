import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

import User from '#models/user'

const signUp = vine.compile(
  vine.object({
    email: vine.string().email().normalizeEmail(),
    // As long as admin:create asks for: an account can be made admin later.
    password: vine.string().minLength(12).maxLength(256),
    fullName: vine.string().trim().minLength(1).maxLength(60).optional(),
  })
)

export default class AccountController {
  /**
   * Opens an account and signs it in. It is always a member's: what a member
   * can do is what a visitor can, so an open form gives nothing away, and an
   * admin is only ever made by another admin.
   */
  async store({ request, response, auth }: HttpContext) {
    const { email, password, fullName } = await signUp.validate(request.all())

    if (await User.findBy('email', email)) {
      return response.conflict({ message: 'An account already uses that email.' })
    }

    const user = await User.create({ email, password, fullName: fullName ?? null, role: 'member' })
    await auth.use('web').login(user)

    return response.created({ email: user.email, role: user.role })
  }
}
