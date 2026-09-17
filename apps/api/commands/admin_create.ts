import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

import User from '#models/user'

/**
 * Creates or re-passwords the admin account. Kept as a command rather than a
 * sign-up page: the site has exactly one administrator and an open registration
 * form would be a way in, not a feature.
 */
export default class AdminCreate extends BaseCommand {
  static commandName = 'admin:create'
  static description = 'Create the admin account, or set a new password for it'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Email address' })
  declare email: string

  async run() {
    const password = await this.prompt.secure('Password (at least 12 characters)', {
      validate: (value) => (value ?? '').length >= 12 || 'Use at least 12 characters',
    })

    const user = await User.updateOrCreate({ email: this.email }, { password })

    this.logger.success(`admin ${user.email} ready — sign in at /admin`)
  }
}
