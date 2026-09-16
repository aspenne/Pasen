import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

import Setting from '#models/setting'
import StaticChampion from '#models/static_champion'
import StaticItem from '#models/static_item'
import StaticQueue from '#models/static_queue'
import { DDragonService } from '#static_data/ddragon_service'

const VERSIONS = ['16.18.1', '16.17.1']

const CHAMPIONS = {
  data: {
    Aatrox: {
      key: '266',
      id: 'Aatrox',
      name: 'Aatrox',
      title: 'the Darkin Blade',
      tags: ['Fighter'],
      image: { full: 'Aatrox.png' },
    },
  },
}

const ITEMS = {
  data: {
    '1001': { name: 'Boots', plaintext: 'Speed', gold: { total: 300 }, image: { full: '1001.png' } },
    // Data Dragon carries a few non-numeric keys that no match payload ever
    // references; the service must drop them rather than insert NaN ids.
    'Muramana': { name: 'Muramana', gold: { total: 0 }, image: { full: 'x.png' } },
  },
}

const SPELLS = {
  data: {
    SummonerFlash: { key: '4', id: 'SummonerFlash', name: 'Flash', image: { full: 'Flash.png' } },
  },
}

const QUEUES = [
  { queueId: 420, map: "Summoner's Rift", description: '5v5 Ranked Solo', notes: null },
]

/** Serves the Data Dragon payloads and records what was actually requested. */
function stubFetch(versions = VERSIONS) {
  const urls: string[] = []

  const impl = async (url: string) => {
    urls.push(String(url))
    const target = String(url)
    const body = target.includes('versions.json')
      ? versions
      : target.includes('champion.json')
        ? CHAMPIONS
        : target.includes('item.json')
          ? ITEMS
          : target.includes('summoner.json')
            ? SPELLS
            : QUEUES

    return new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json' },
    })
  }

  return { impl: impl as unknown as typeof fetch, urls }
}

test.group('DDragonService', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('imports the newest patch and records the version', async ({ assert }) => {
    const fetch = stubFetch()
    const result = await new DDragonService({ fetch: fetch.impl }).sync()

    assert.equal(result.version, '16.18.1')
    assert.isFalse(result.skipped)
    assert.equal(result.champions, 1)
    assert.equal(result.queues, 1)

    const aatrox = await StaticChampion.find(266)
    assert.equal(aatrox?.slug, 'Aatrox')
    assert.deepEqual(aatrox?.tags, ['Fighter'])

    const version = await Setting.find('ddragon.version')
    assert.equal(version?.value, '16.18.1')
  })

  test('drops data dragon keys that are not numeric item ids', async ({ assert }) => {
    const fetch = stubFetch()
    const result = await new DDragonService({ fetch: fetch.impl }).sync()

    assert.equal(result.items, 1, 'Muramana has no numeric id and cannot be joined on')
    assert.isNotNull(await StaticItem.find(1001))
  })

  test('skips the import when the patch has not moved', async ({ assert }) => {
    await new DDragonService({ fetch: stubFetch().impl }).sync()

    const second = stubFetch()
    const result = await new DDragonService({ fetch: second.impl }).sync()

    assert.isTrue(result.skipped)
    assert.lengthOf(second.urls, 1, 'only versions.json should be fetched')
  })

  test('re-imports on demand even when the patch is unchanged', async ({ assert }) => {
    await new DDragonService({ fetch: stubFetch().impl }).sync()

    const result = await new DDragonService({ fetch: stubFetch().impl }).sync({ force: true })

    assert.isFalse(result.skipped)
    assert.equal(result.champions, 1)
  })

  test('is idempotent: a second import updates rather than duplicates', async ({ assert }) => {
    await new DDragonService({ fetch: stubFetch().impl }).sync()
    await new DDragonService({ fetch: stubFetch().impl }).sync({ force: true })

    assert.lengthOf(await StaticChampion.all(), 1)
    assert.lengthOf(await StaticQueue.all(), 1)
  })

  test('never spends riot api budget: data dragon is a public cdn', async ({ assert }) => {
    const fetch = stubFetch()
    await new DDragonService({ fetch: fetch.impl }).sync()

    for (const url of fetch.urls) {
      assert.notInclude(url, 'api.riotgames.com/lol')
    }
  })

  test('fails loudly when data dragon returns no versions', async ({ assert }) => {
    const fetch = stubFetch([])
    await assert.rejects(
      () => new DDragonService({ fetch: fetch.impl }).sync(),
      /returned no versions/
    )
  })
})
