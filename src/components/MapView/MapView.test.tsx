import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MapView } from './MapView'
import type { Site } from '../../types/site'

const mockSites: Site[] = [
  {
    id: 'site-1',
    name: 'Sao Paulo',
    slug: 'sao-paulo',
    latitude: -23.55,
    longitude: -46.63,
    status: 'approved',
    region: 'South America',
    country: 'Brazil',
    country_code: 'BR',
    notes: null,
    created_at: '2026-04-02T12:00:00Z',
    updated_at: '2026-04-02T12:00:00Z',
  },
  {
    id: 'site-2',
    name: 'Nairobi',
    slug: 'nairobi',
    latitude: -1.29,
    longitude: 36.82,
    status: 'candidate',
    region: 'East Africa',
    country: 'Kenya',
    country_code: 'KE',
    notes: null,
    created_at: '2026-04-02T12:00:00Z',
    updated_at: '2026-04-02T12:00:00Z',
  },
]

describe('MapView', () => {
  it('renders the map container', () => {
    render(
      <MapView
        viewState={{ longitude: 0, latitude: 20, zoom: 2 }}
        onViewStateChange={() => {}}
        sites={[]}
      />
    )
    expect(document.querySelector('.map-container')).toBeInTheDocument()
  })

  it('renders a marker for each site', () => {
    render(
      <MapView
        viewState={{ longitude: 0, latitude: 20, zoom: 2 }}
        onViewStateChange={() => {}}
        sites={mockSites}
      />
    )
    const markers = screen.getAllByTestId('marker')
    expect(markers).toHaveLength(2)
  })

  it('renders score pins with site names as title', () => {
    render(
      <MapView
        viewState={{ longitude: 0, latitude: 20, zoom: 2 }}
        onViewStateChange={() => {}}
        sites={mockSites}
        siteScores={{ 'site-1': 87, 'site-2': 55 }}
      />
    )
    expect(screen.getByTitle('Sao Paulo')).toBeInTheDocument()
    expect(screen.getByTitle('Nairobi')).toBeInTheDocument()
  })

  it('calls onSelectSite when a marker is clicked', async () => {
    const user = userEvent.setup()
    const onSelectSite = vi.fn()
    render(
      <MapView
        viewState={{ longitude: 0, latitude: 20, zoom: 2 }}
        onViewStateChange={() => {}}
        sites={mockSites}
        onSelectSite={onSelectSite}
      />
    )
    const markers = screen.getAllByTestId('marker')
    await user.click(markers[0])
    expect(onSelectSite).toHaveBeenCalledWith('site-1')
  })

  it('calls onMapClick when clicking empty map area', async () => {
    const user = userEvent.setup()
    const onMapClick = vi.fn()
    render(
      <MapView
        viewState={{ longitude: 0, latitude: 20, zoom: 2 }}
        onViewStateChange={() => {}}
        sites={[]}
        onMapClick={onMapClick}
      />
    )
    await user.click(screen.getByTestId('map'))
    expect(onMapClick).toHaveBeenCalledWith({ latitude: 20.0, longitude: 10.0 })
  })
})
