import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { RunePair } from '@/components/RunePair'
import type { StaticData } from '@/lib/api'

const perks = { styles: [{ style: 8400, selections: [{ perk: 8437 }] }, { style: 8300 }] }

const complete = {
  version: '16.18.1',
  champions: {},
  summonerSpells: {},
  queues: {},
  runes: {
    8437: { kind: 'perk', name: 'Grasp of the Undying', image: 'perk-images/a.png' },
    8300: { kind: 'style', name: 'Inspiration', image: 'perk-images/b.png' },
  },
} as unknown as StaticData

describe('RunePair', () => {
  it('draws the keystone and the secondary tree', () => {
    const { getByAltText } = render(<RunePair perks={perks} staticData={complete} />)

    expect(getByAltText('Grasp of the Undying')).toBeInTheDocument()
    expect(getByAltText('Inspiration')).toBeInTheDocument()
  })

  it('survives a cached payload from before runes existed', () => {
    // A browser holding the previous /api/static has no `runes` key at all,
    // and reading 8437 out of it threw on exactly one device.
    const stale = { version: '16.18.1', champions: {}, summonerSpells: {}, queues: {} }

    expect(() =>
      render(<RunePair perks={perks} staticData={stale as unknown as StaticData} />)
    ).not.toThrow()
  })

  it('draws nothing when every id is zero, as Arena sends them', () => {
    const zeroed = { styles: [{ style: 0, selections: [{ perk: 0 }] }, { style: 0 }] }
    const { container } = render(<RunePair perks={zeroed} staticData={complete} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders empty slots rather than breaking on an unknown id', () => {
    const unknown = { styles: [{ style: 9999, selections: [{ perk: 9998 }] }, { style: 9997 }] }
    const { container, queryByRole } = render(
      <RunePair perks={unknown} staticData={complete} />
    )

    expect(container).not.toBeEmptyDOMElement()
    expect(queryByRole('img')).toBeNull()
  })
})
