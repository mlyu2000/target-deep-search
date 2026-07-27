import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SessionList from '../../components/SessionList'
import type { Session } from '../../types'

const sessions: Session[] = [
  { id: 's1', target: 'Acme Corp', depth: 2, status: 'complete', error_msg: null, report_type: 'graph', created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00' },
  { id: 's2', target: 'Globex', depth: 1, status: 'complete', error_msg: null, report_type: 'graph', created_at: '2026-01-02T00:00:00', updated_at: '2026-01-02T00:00:00' },
]

describe('SessionList', () => {
  it('labels the panel "History" not "Saved"', () => {
    render(<SessionList sessions={sessions} onSelect={() => {}} onDelete={() => {}} onClear={() => {}} />)
    expect(screen.getByText('History')).toBeInTheDocument()
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('shows a Clear button when there are sessions and calls onClear after confirm', () => {
    window.confirm = vi.fn(() => true)
    const onClear = vi.fn()
    render(<SessionList sessions={sessions} onSelect={() => {}} onDelete={() => {}} onClear={onClear} />)
    const clearBtn = screen.getByText('Clear')
    expect(clearBtn).toBeInTheDocument()
    fireEvent.click(clearBtn)
    expect(window.confirm).toHaveBeenCalled()
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('hides the Clear button when there are no sessions', () => {
    render(<SessionList sessions={[]} onSelect={() => {}} onDelete={() => {}} onClear={() => {}} />)
    expect(screen.queryByText('Clear')).toBeNull()
  })
})
