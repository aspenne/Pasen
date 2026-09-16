import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import string from '@adonisjs/core/helpers/string'

import Group from '#models/group'

export default class PasenGroup extends BaseCommand {
  static commandName = 'pasen:group'
  static description = 'Create a group, or list the existing ones'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Group name, e.g. ARIGAFION', required: false })
  declare name?: string

  async run() {
    if (this.name) {
      const group = await Group.updateOrCreate(
        { slug: string.slug(this.name).toLowerCase() },
        { name: this.name }
      )
      this.logger.success(`group ${group.name} available at /${group.slug}`)
    }

    for (const group of await Group.query().preload('members')) {
      this.logger.info(`/${group.slug}  ${group.name}  (${group.members.length} members)`)
    }
  }
}
