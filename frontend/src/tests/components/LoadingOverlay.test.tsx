import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LoadingOverlay from '../../components/LoadingOverlay'

describe('LoadingOverlay', () => {
  it('shows status message', () => {
    render(<LoadingOverlay message="Searching..." />)
    expect(screen.getByText('Searching...')).toBeInTheDocument()
  })

  it('shows spinner when not error', () => {
    render(<LoadingOverlay message="Building..." />)
    expect(document.querySelector('.loading-spinner')).toBeInTheDocument()
  })

  it('shows error icon when isError', () => {
    render(<LoadingOverlay message="Failed" isError />)
    expect(screen.getByText('!')).toBeInTheDocument()
  })

  it('calls onRetry when retry clicked', () => {
    const onRetry = vi.fn()
    render(<LoadingOverlay message="Failed" isError onRetry={onRetry} onCancel={() => {}} />)
    fireEvent.click(screen.getByText('Retry'))
    expect(onRetry).toHaveBeenCalled()
  })

  it('calls onCancel when cancel clicked', () => {
    const onCancel = vi.fn()
    render(<LoadingOverlay message="Building..." onCancel={onCancel} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalled()
  })
})
