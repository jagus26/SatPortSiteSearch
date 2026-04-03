import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { Site } from './types/site'

const mockSite: Site = {
  id: 'site-1',
  name: 'Sao Paulo Station',
  slug: 'sao-paulo-station',
  latitude: -23.5505,
  longitude: -46.6333,
  status: 'approved',
  region: 'South America',
  country: 'Brazil',
  country_code: 'BR',
  notes: null,
  created_at: '2026-04-02T12:00:00Z',
  updated_at: '2026-04-02T12:00:00Z',
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => [mockSite],
  } as Response)
})

describe('App', () => {
  it('renders the search bar and map', () => {
    render(<App />)
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
    expect(document.querySelector('.map-container')).toBeInTheDocument()
  })

  it('renders the toolbar with Add Site button', () => {
    render(<App />)
    expect(screen.getByText('+ Add Site')).toBeInTheDocument()
  })

  it('fetches and renders site markers on mount', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByTitle('Sao Paulo Station')).toBeInTheDocument()
    })
  })

  it('opens create panel when Add Site is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByText('+ Add Site'))
    expect(screen.getByText('Add New Site')).toBeInTheDocument()
  })

  it('closes panel when close button is clicked', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByText('+ Add Site'))
    expect(screen.getByText('Add New Site')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Close panel'))
    expect(screen.queryByText('Add New Site')).not.toBeInTheDocument()
  })
})
