import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SearchInput from '../../components/SearchInput'

describe('SearchInput', () => {
  it('renders input and button', () => {
    render(<SearchInput value="" onChange={() => {}} onSubmit={() => {}} />)
    expect(screen.getByPlaceholderText(/enter/i)).toBeInTheDocument()
    expect(screen.getByText('Search')).toBeInTheDocument()
  })

  it('button is disabled when input is empty', () => {
    render(<SearchInput value="" onChange={() => {}} onSubmit={() => {}} />)
    expect(screen.getByText('Search')).toBeDisabled()
  })

  it('button is enabled when text is entered', () => {
    render(<SearchInput value="Tesla" onChange={() => {}} onSubmit={() => {}} />)
    expect(screen.getByText('Search')).toBeEnabled()
  })

  it('calls onSubmit on button click', () => {
    const onSubmit = vi.fn()
    render(<SearchInput value="Tesla" onChange={() => {}} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByText('Search'))
    expect(onSubmit).toHaveBeenCalledWith('Tesla')
  })

  it('calls onSubmit on Enter key', () => {
    const onSubmit = vi.fn()
    render(<SearchInput value="Tesla" onChange={() => {}} onSubmit={onSubmit} />)
    fireEvent.keyDown(screen.getByPlaceholderText(/enter/i), { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('Tesla')
  })

  it('trims whitespace before submit', () => {
    const onSubmit = vi.fn()
    render(<SearchInput value="  Tesla  " onChange={() => {}} onSubmit={onSubmit} />)
    fireEvent.click(screen.getByText('Search'))
    expect(onSubmit).toHaveBeenCalledWith('Tesla')
  })
})
