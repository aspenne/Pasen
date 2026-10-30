import { test } from '@japa/runner'

import { ddragonText } from '#static_data/ddragon_text'

test.group('ddragonText', () => {
  test('keeps an item’s stats and active as lines of plain text', ({ assert }) => {
    const html =
      '<mainText><stats><attention>105</attention> Ability Power<br><attention>50</attention> Armor</stats><br><br><br><br><active>Time Stop</active><br>Enter <keyword>Stasis</keyword> for 2.5 seconds.</mainText>'

    assert.equal(
      ddragonText(html),
      '105 Ability Power\n50 Armor\n\nTime Stop\nEnter Stasis for 2.5 seconds.'
    )
  })

  test('drops a rune’s client-only tags and its lore line', ({ assert }) => {
    const html =
      "Hitting a champion with 3 <b>separate</b> attacks deals bonus <lol-uikit-tooltipped-keyword key='X'><font color='#48C4B7'>adaptive damage</font></lol-uikit-tooltipped-keyword>.<br><br>Cooldown: 20s<br><br><i>'We called them the Thunderlords.'</i>"

    assert.equal(
      ddragonText(html),
      'Hitting a champion with 3 separate attacks deals bonus adaptive damage.\n\nCooldown: 20s'
    )
  })

  test('has nothing for an empty description', ({ assert }) => {
    assert.isNull(ddragonText(''))
    assert.isNull(ddragonText('<mainText><stats></stats><br><br></mainText>'))
    assert.isNull(ddragonText(undefined))
  })
})
