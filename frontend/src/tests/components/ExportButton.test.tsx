import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ExportButton from '../../components/ExportButton'

describe('ExportButton', () => {
  it('renders with label', () => {
    render(<ExportButton taskId="test-123" />)
    expect(screen.getByText(/Export JSON/)).toBeInTheDocument()
  })
})
