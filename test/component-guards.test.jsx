import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { useDetail, DetailContext } from '../src/context/detail.js'

/**
 * The match-detail opener is read through context by every card and bracket
 * slot. App provides it; anything rendered outside App (a component test, a
 * future embed) falls back to the default, which therefore has to be callable
 * rather than undefined.
 */

describe('DetailContext', () => {
  it('is safe to call outside a provider', () => {
    // Components read the opener unconditionally; without App above them the
    // default has to be callable rather than undefined.
    let opener
    function Probe() {
      opener = useDetail()
      return null
    }
    render(<Probe />)
    expect(typeof opener).toBe('function')
    expect(() => opener({ num: 1 })).not.toThrow()
    expect(opener()).toBeUndefined()
  })

  it('hands through the opener a provider supplies', () => {
    const open = vi.fn()
    let opener
    function Probe() {
      opener = useDetail()
      return null
    }
    render(
      <DetailContext.Provider value={open}>
        <Probe />
      </DetailContext.Provider>,
    )
    opener({ num: 7 })
    expect(open).toHaveBeenCalledWith({ num: 7 })
  })
})
