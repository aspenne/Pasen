import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * A member is a person; a group is a roster they belong to. The two are joined
 * through a pivot rather than a column on members, because the point of the
 * product is that a second group can be added later and someone may be in both.
 */
export default class extends BaseSchema {
  async up() {
    this.schema.createTable('groups', (table) => {
      table.increments('id')
      // The URL segment: /arigafion
      table.string('slug').notNullable().unique()
      table.string('name').notNullable()
      // "Games today" needs a day boundary, and the group decides which one.
      table.string('timezone').notNullable().defaultTo('Europe/Paris')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.createTable('members', (table) => {
      table.increments('id')
      table.string('slug').notNullable().unique()
      // The nickname the group uses, which is not any of their Riot IDs.
      table.string('display_name').notNullable()
      table.string('avatar_url').nullable()
      // Keeps a person the same colour across every chart on the site.
      table.string('accent_color').nullable()
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()
    })

    this.schema.createTable('group_members', (table) => {
      table.increments('id')
      table.integer('group_id').unsigned().notNullable().references('id').inTable('groups').onDelete('CASCADE')
      table.integer('member_id').unsigned().notNullable().references('id').inTable('members').onDelete('CASCADE')
      table.string('role').notNullable().defaultTo('member')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.timestamp('updated_at', { useTz: true }).notNullable()

      table.unique(['group_id', 'member_id'])
    })
  }

  async down() {
    this.schema.dropTable('group_members')
    this.schema.dropTable('members')
    this.schema.dropTable('groups')
  }
}
