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

  it('supports depth 5 with Full network label', () => {
    render(<DepthControl value={5} onChange={() => {}} />)
    expect(screen.getByText(/Full network/)).toBeInTheDocument()
  })

  it('slider max is 5', () => {
    render(<DepthControl value={5} onChange={() => {}} />)
    const slider = screen.getByRole('slider') as HTMLInputElement
    expect(slider.max).toBe('5')
  })

  it('renders all 5 depth labels', () => {
    const { rerender } = render(<DepthControl value={1} onChange={() => {}} />)
    expect(screen.getByText(/Shallow/)).toBeInTheDocument()

    rerender(<DepthControl value={2} onChange={() => {}} />)
    expect(screen.getByText(/Moderate/)).toBeInTheDocument()

    rerender(<DepthControl value={3} onChange={() => {}} />)
    expect(screen.getByText(/Deep/)).toBeInTheDocument()

    rerender(<DepthControl value={4} onChange={() => {}} />)
    expect(screen.getByText(/Comprehensive/)).toBeInTheDocument()

    rerender(<DepthControl value={5} onChange={() => {}} />)
    expect(screen.getByText(/Full network/)).toBeInTheDocument()
  })
})
