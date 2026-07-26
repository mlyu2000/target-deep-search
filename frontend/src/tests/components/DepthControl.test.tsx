import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DepthControl from '../../components/DepthControl'

describe('DepthControl', () => {
  it('renders slider with labels', () => {
    render(<DepthControl value={2} onChange={() => {}} />)
    expect(screen.getByText(/Moderate/)).toBeInTheDocument()
  })

  it('defaults to value 2', () => {
    render(<DepthControl value={2} onChange={() => {}} />)
    const strong = document.querySelector('strong')
    expect(strong).toHaveTextContent('2')
  })

  it('calls onChange on slide', () => {
    const onChange = vi.fn()
    render(<DepthControl value={2} onChange={onChange} />)
    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '3' } })
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('shows correct label for each depth', () => {
    const { rerender } = render(<DepthControl value={1} onChange={() => {}} />)
    expect(screen.getByText(/Shallow/)).toBeInTheDocument()

    rerender(<DepthControl value={4} onChange={() => {}} />)
    expect(screen.getByText(/Comprehensive/)).toBeInTheDocument()
  })
})
