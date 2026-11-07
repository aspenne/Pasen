import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'

import Member from '#models/member'
import User, { USER_ROLES } from '#models/user'

const userPatch = vine.compile(
  vine.object({
    role: vine.enum(USER_ROLES).optional(),
    // null unlinks the account from its player.
    memberSlug: vine.string().nullable().optional(),
  })
)

function present(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    memberSlug: user.member?.slug ?? null,
    memberName: user.member?.displayName ?? null,
    createdAt: user.createdAt.toISO(),
  }
}

/** Who has an account, what they may do, and which player they are. */
export default class UsersController {
  async index({ response }: HttpContext) {
    const users = await User.query().preload('member').orderBy('created_at', 'asc')
    return response.ok({ users: users.map(present) })
  }

  async update({ params, request, response, auth }: HttpContext) {
    const user = await User.findOrFail(params.id)
    const payload = await userPatch.validate(request.all())

    // Demoting yourself is how a site ends up with no admin at all.
    if (user.id === auth.user!.id && payload.role && payload.role !== 'admin') {
      return response.conflict({ message: 'You cannot take your own admin rights away.' })
    }

    if (payload.role) user.role = payload.role
    if (payload.memberSlug !== undefined) {
      if (payload.memberSlug === null) {
        user.memberId = null
      } else {
        const member = await Member.findBy('slug', payload.memberSlug)
        if (!member) return response.unprocessableEntity({ message: 'No player with that slug.' })
        user.memberId = member.id
      }
    }
    await user.save()
    await user.load('member')

    return response.ok(present(user))
  }
}
