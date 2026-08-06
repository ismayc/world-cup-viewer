import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useModalA11y } from '../src/hooks/useModalA11y.js'

// jsdom reports offsetParent === null for every element, which the hook's
// visibility filter would treat as "not focusable". Make rendered elements look
// visible so the focus-trap logic runs.
let origOffsetParent
beforeAll(() => {
  origOffsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent')
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      return this.parentNode
    },
  })
})
afterAll(() => {
  if (origOffsetParent) Object.defineProperty(HTMLElement.prototype, 'offsetParent', origOffsetParent)
})

function Modal({ onClose, empty = false }) {
  const ref = useModalA11y(onClose)
  return (
    <div ref={ref} tabIndex={-1} data-testid="dialog">
      {!empty && (
        <>
          <button data-testid="first">First</button>
          <button data-testid="middle">Middle</button>
          <button data-testid="last">Last</button>
        </>
      )}
    </div>
  )
}

describe('useModalA11y', () => {
  it('focuses the first focusable element on open', () => {
    const { getByTestId } = render(<Modal onClose={() => {}} />)
    expect(document.activeElement).toBe(getByTestId('first'))
  })

  it('focuses the container when there are no focusable children', () => {
    const { getByTestId } = render(<Modal onClose={() => {}} empty />)
    expect(document.activeElement).toBe(getByTestId('dialog'))
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(<Modal onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('ignores non-Tab, non-Escape keys', () => {
    const onClose = vi.fn()
    render(<Modal onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'a' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('wraps focus from last to first on Tab', () => {
    const { getByTestId } = render(<Modal onClose={() => {}} />)
    getByTestId('last').focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(getByTestId('first'))
  })

  it('wraps focus from first to last on Shift+Tab', () => {
    const { getByTestId } = render(<Modal onClose={() => {}} />)
    getByTestId('first').focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(getByTestId('last'))
  })

  it('does not trap when focus is in the middle (no wrap)', () => {
    const { getByTestId } = render(<Modal onClose={() => {}} />)
    getByTestId('middle').focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    // No preventDefault path taken; focus stays where the browser would move it
    // (jsdom doesn't advance focus), so it's still middle.
    expect(document.activeElement).toBe(getByTestId('middle'))
  })

  it('Tab is a no-op when there are no focusable elements', () => {
    const onClose = vi.fn()
    render(<Modal onClose={onClose} empty />)
    // Should not throw and should not call onClose.
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('restores focus to the previously focused element on unmount', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const { unmount } = render(<Modal onClose={() => {}} />)
    expect(document.activeElement).not.toBe(trigger) // moved into dialog
    unmount()
    expect(document.activeElement).toBe(trigger) // restored
    trigger.remove()
  })

  it('has nothing to restore when nothing was focused before it opened', () => {
    // A modal opened from a keyboard shortcut rather than a button: there is no
    // trigger holding focus, so closing must simply leave focus alone instead of
    // reaching for a focus() that isn't there.
    let unmount
    Object.defineProperty(document, 'activeElement', { configurable: true, get: () => null })
    try {
      ;({ unmount } = render(<Modal onClose={() => {}} />))
    } finally {
      delete document.activeElement // back to jsdom's real getter
    }
    expect(() => unmount()).not.toThrow()
  })
})
