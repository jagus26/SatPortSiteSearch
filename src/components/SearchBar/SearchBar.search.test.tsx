import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../services/geocoding', () => ({
  searchByName: vi.fn().mockResolvedValue([
    {
      displayName: 'London, England, United Kingdom',
      latitude: 51.5074,
      longitude: -0.1278,
      boundingBox: [51.2867, 51.6919, -0.5103, 0.334] as [number, number, number, number],
      type: 'place' as const,
    },
  ]),
  parseCoordinates: vi.fn().mockReturnValue(null),
}))

import { SearchBar } from './SearchBar'

describe('SearchBar name search', () => {
  it('displays dropdown results for name search', async () => {
    const user = userEvent.setup()
    render(<SearchBar onSelect={() => {}} />)

    const input = screen.getByPlaceholderText(/search/i)
    await user.type(input, 'London')

    // Wait for debounced results
    const result = await screen.findByText(/London, England/i)
    expect(result).toBeInTheDocument()
  })
})
