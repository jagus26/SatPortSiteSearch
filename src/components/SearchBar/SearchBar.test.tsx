import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBar } from './SearchBar'

describe('SearchBar', () => {
  it('renders the search input', () => {
    render(<SearchBar onSelect={() => {}} />)
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
  })

  it('shows coordinate result for valid lat/lon input', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<SearchBar onSelect={onSelect} />)

    const input = screen.getByPlaceholderText(/search/i)
    await user.type(input, '51.5074, -0.1278')
    await user.keyboard('{Enter}')

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 51.5074,
        longitude: -0.1278,
        type: 'coordinates',
      })
    )
  })
})
