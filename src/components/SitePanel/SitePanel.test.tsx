import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SiteDetail } from './SiteDetail'
import { SiteForm } from './SiteForm'
import { ScoreBar } from './ScoreBar'
import { ScoreBreakdown } from './ScoreBreakdown'
import type { Site, CompositeScore } from '../../types/site'

const mockSite: Site = {
  id: '123e4567-e89b-12d3-a456-426614174000',
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

const mockScores: CompositeScore = {
  site_id: '123e4567-e89b-12d3-a456-426614174000',
  composite: 82.5,
  scores: { connectivity: 90, environmental: 75 },
  details: {
    connectivity: { raw_score: 90, data_json: { ixp_count_100km: 3, nearest_ixp_km: 12.5 }, source: 'peeringdb' },
    environmental: { raw_score: 75, data_json: { avg_temp_c: 22.0, avg_precipitation_mm: 2.0, avg_solar_kwh_m2: 5.0, avg_wind_speed_ms: 3.0 }, source: 'nasa_power' },
  },
}

describe('ScoreBar', () => {
  it('renders label and score value', () => {
    render(<ScoreBar label="Connectivity" score={90} />)
    expect(screen.getByText('Connectivity')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
  })

  it('renders green bar for score >= 70', () => {
    const { container } = render(<ScoreBar label="Test" score={85} />)
    const fill = container.querySelector('.score-bar-fill')
    expect(fill).toHaveStyle({ width: '85%' })
  })
})

describe('SiteDetail', () => {
  it('renders site name and status', () => {
    render(<SiteDetail site={mockSite} scores={mockScores} onClose={() => {}} onEnrich={() => Promise.resolve()} isEnriching={false} />)
    expect(screen.getByText('Sao Paulo Station')).toBeInTheDocument()
    expect(screen.getByText('approved')).toBeInTheDocument()
  })

  it('renders composite score', () => {
    render(<SiteDetail site={mockSite} scores={mockScores} onClose={() => {}} onEnrich={() => Promise.resolve()} isEnriching={false} />)
    expect(screen.getByText('83')).toBeInTheDocument()
  })

  it('renders category scores', () => {
    render(<SiteDetail site={mockSite} scores={mockScores} onClose={() => {}} onEnrich={() => Promise.resolve()} isEnriching={false} />)
    expect(screen.getByText('Connectivity')).toBeInTheDocument()
    expect(screen.getByText('90')).toBeInTheDocument()
    expect(screen.getByText('Environmental')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('renders coordinates', () => {
    render(<SiteDetail site={mockSite} scores={mockScores} onClose={() => {}} onEnrich={() => Promise.resolve()} isEnriching={false} />)
    expect(screen.getByText(/-23\.5505.*-46\.6333/)).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<SiteDetail site={mockSite} scores={mockScores} onClose={onClose} onEnrich={() => Promise.resolve()} isEnriching={false} />)
    await user.click(screen.getByLabelText('Close panel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows "No scores yet" when composite is null', () => {
    const noScores: CompositeScore = { site_id: mockSite.id, composite: null, scores: {} }
    render(<SiteDetail site={mockSite} scores={noScores} onClose={() => {}} onEnrich={() => Promise.resolve()} isEnriching={false} />)
    expect(screen.getByText('No scores yet')).toBeInTheDocument()
  })
})

describe('SiteForm', () => {
  it('renders form fields', () => {
    render(<SiteForm onSubmit={() => {}} onClose={() => {}} />)
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Latitude')).toBeInTheDocument()
    expect(screen.getByLabelText('Longitude')).toBeInTheDocument()
  })

  it('pre-fills coordinates when provided', () => {
    render(
      <SiteForm
        onSubmit={() => {}}
        onClose={() => {}}
        initialCoords={{ latitude: -23.55, longitude: -46.63 }}
      />
    )
    expect(screen.getByLabelText('Latitude')).toHaveValue(-23.55)
    expect(screen.getByLabelText('Longitude')).toHaveValue(-46.63)
  })

  it('auto-generates slug from name', async () => {
    const user = userEvent.setup()
    render(<SiteForm onSubmit={() => {}} onClose={() => {}} />)
    await user.type(screen.getByLabelText('Name'), 'Sao Paulo Station')
    expect(screen.getByLabelText('Slug')).toHaveValue('sao-paulo-station')
  })

  it('calls onSubmit with form data', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(
      <SiteForm
        onSubmit={onSubmit}
        onClose={() => {}}
        initialCoords={{ latitude: -23.55, longitude: -46.63 }}
      />
    )
    await user.type(screen.getByLabelText('Name'), 'Test Site')
    await user.click(screen.getByText('Create Site'))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Site',
        slug: 'test-site',
        latitude: -23.55,
        longitude: -46.63,
      })
    )
  })

  it('calls onClose when close button clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<SiteForm onSubmit={() => {}} onClose={onClose} />)
    await user.click(screen.getByLabelText('Close panel'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('ScoreBreakdown', () => {
  it('renders metric rows with values and sub-scores', () => {
    const dataJson = { avg_temp_c: 19.63, avg_precipitation_mm: 3.7 }
    render(<ScoreBreakdown category="environmental" dataJson={dataJson} />)
    expect(screen.getByText('Temperature')).toBeInTheDocument()
    expect(screen.getByText('19.6°C')).toBeInTheDocument()
    expect(screen.getByText('Precipitation')).toBeInTheDocument()
    expect(screen.getByText('3.7mm/day')).toBeInTheDocument()
  })

  it('renders explanations', () => {
    const dataJson = { avg_temp_c: 20.0 }
    render(<ScoreBreakdown category="environmental" dataJson={dataJson} />)
    expect(screen.getByText('Ideal range for outdoor equipment')).toBeInTheDocument()
  })

  it('renders weights as percentages', () => {
    const dataJson = { avg_temp_c: 20.0 }
    render(<ScoreBreakdown category="environmental" dataJson={dataJson} />)
    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  it('renders nothing for unknown category', () => {
    const { container } = render(<ScoreBreakdown category="unknown" dataJson={{}} />)
    expect(container.querySelector('.score-breakdown')).toBeNull()
  })
})

describe('SiteDetail enrichment', () => {
  it('renders Fetch Scores button', () => {
    render(
      <SiteDetail
        site={mockSite}
        scores={mockScores}
        onClose={() => {}}
        onEnrich={() => Promise.resolve()}
        isEnriching={false}
      />
    )
    expect(screen.getByText('Fetch Scores')).toBeInTheDocument()
  })

  it('calls onEnrich when Fetch Scores is clicked', async () => {
    const user = userEvent.setup()
    const onEnrich = vi.fn().mockResolvedValue(undefined)
    render(
      <SiteDetail
        site={mockSite}
        scores={mockScores}
        onClose={() => {}}
        onEnrich={onEnrich}
        isEnriching={false}
      />
    )
    await user.click(screen.getByText('Fetch Scores'))
    expect(onEnrich).toHaveBeenCalledOnce()
  })

  it('shows Fetching... when enriching', () => {
    render(
      <SiteDetail
        site={mockSite}
        scores={mockScores}
        onClose={() => {}}
        onEnrich={() => Promise.resolve()}
        isEnriching={true}
      />
    )
    expect(screen.getByText('Fetching...')).toBeInTheDocument()
    expect(screen.getByText('Fetching...').closest('button')).toBeDisabled()
  })
})

describe('ScoreBar expandable', () => {
  it('expands breakdown on click when details provided', async () => {
    const user = userEvent.setup()
    const detail = { raw_score: 84, data_json: { avg_temp_c: 19.63 }, source: 'nasa_power' }
    render(<ScoreBar label="Environmental" score={84} category="environmental" detail={detail} />)

    expect(screen.queryByText('Temperature')).not.toBeInTheDocument()
    await user.click(screen.getByText('Environmental'))
    expect(screen.getByText('Temperature')).toBeInTheDocument()
  })

  it('collapses breakdown on second click', async () => {
    const user = userEvent.setup()
    const detail = { raw_score: 84, data_json: { avg_temp_c: 19.63 }, source: 'nasa_power' }
    render(<ScoreBar label="Environmental" score={84} category="environmental" detail={detail} />)

    await user.click(screen.getByText('Environmental'))
    expect(screen.getByText('Temperature')).toBeInTheDocument()
    await user.click(screen.getByText('Environmental'))
    expect(screen.queryByText('Temperature')).not.toBeInTheDocument()
  })

  it('does not expand when no detail provided', async () => {
    const user = userEvent.setup()
    render(<ScoreBar label="Environmental" score={84} />)
    await user.click(screen.getByText('Environmental'))
    expect(screen.queryByText('Temperature')).not.toBeInTheDocument()
  })
})
