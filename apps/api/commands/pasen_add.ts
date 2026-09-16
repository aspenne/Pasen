import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import string from '@adonisjs/core/helpers/string'
import { isPlatform } from '@pasen/shared'
import { DateTime } from 'luxon'

import Group from '#models/group'
import Member from '#models/member'
import { AccountLinker } from '#ingestion/account_linker'
import { riot } from '#riot/service'

export default class PasenAdd extends BaseCommand {
  static commandName = 'pasen:add'
  static description = 'Add a Riot account to a group, creating the member if needed'
  static options: CommandOptions = { startApp: true }

  @args.string({ description: 'Group slug, e.g. arigafion' })
  declare group: string

  @args.string({ description: 'Riot ID, e.g. "3C Patate Chaude#CCC"' })
  declare riotId: string

  @args.string({ description: 'Platform, e.g. euw1' })
  declare platform: string

  @flags.string({ description: 'Member to attach to; defaults to the Riot ID name' })
  declare member?: string

  @flags.string({ description: 'Backfill as far back as this ISO date' })
  declare since?: string

  async run() {
    const [gameName, tagLine] = this.riotId.split('#')
    if (!gameName || !tagLine) {
      this.logger.error('Riot ID must look like "Name#TAG"')
      this.exitCode = 1
      return
    }

    if (!isPlatform(this.platform)) {
      this.logger.error(`unknown platform "${this.platform}"`)
      this.exitCode = 1
      return
    }

    const group = await Group.findByOrFail('slug', this.group)

    const displayName = this.member ?? gameName
    const member = await Member.updateOrCreate(
      { slug: string.slug(displayName).toLowerCase() },
      { displayName }
    )
    await group.related('members').sync([member.id], false)

    const account = await new AccountLinker(riot()).link({
      memberId: member.id,
      gameName,
      tagLine,
      platform: this.platform,
      backfillTarget: this.since ? DateTime.fromISO(this.since, { zone: 'utc' }) : undefined,
    })

    this.logger.success(
      `${account.riotId} (${account.platform}, level ${account.summonerLevel}) ` +
        `linked to ${member.displayName} in /${group.slug}`
    )
  }
}
