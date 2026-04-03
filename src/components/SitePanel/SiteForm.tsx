import { useState, useCallback } from 'react'
import type { SiteCreate } from '../../types/site'
import type { LatLon } from '../../types/map'

interface SiteFormProps {
  onSubmit: (data: SiteCreate) => void
  onClose: () => void
  initialCoords?: LatLon | null
  error?: string | null
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function SiteForm({ onSubmit, onClose, initialCoords, error }: SiteFormProps) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [latitude, setLatitude] = useState<number | ''>(initialCoords?.latitude ?? '')
  const [longitude, setLongitude] = useState<number | ''>(initialCoords?.longitude ?? '')
  const [region, setRegion] = useState('')
  const [country, setCountry] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [notes, setNotes] = useState('')

  const handleNameChange = useCallback((value: string) => {
    setName(value)
    setSlug(toSlug(value))
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data: SiteCreate = {
      name,
      slug,
      latitude: Number(latitude),
      longitude: Number(longitude),
    }
    if (region) data.region = region
    if (country) data.country = country
    if (countryCode) data.country_code = countryCode
    if (notes) data.notes = notes
    onSubmit(data)
  }

  return (
    <div className="site-form">
      <div className="panel-header">
        <h2 className="panel-title">Add New Site</h2>
        <button className="panel-close" onClick={onClose} aria-label="Close panel">
          &times;
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <label className="form-field">
          <span className="form-label">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
          />
        </label>

        <label className="form-field">
          <span className="form-label">Slug</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span className="form-label">Latitude</span>
          <input
            type="number"
            step="any"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value === '' ? '' : Number(e.target.value))}
            required
          />
        </label>

        <label className="form-field">
          <span className="form-label">Longitude</span>
          <input
            type="number"
            step="any"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value === '' ? '' : Number(e.target.value))}
            required
          />
        </label>

        <label className="form-field">
          <span className="form-label">Region</span>
          <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} />
        </label>

        <label className="form-field">
          <span className="form-label">Country</span>
          <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} />
        </label>

        <label className="form-field">
          <span className="form-label">Country Code</span>
          <input
            type="text"
            maxLength={2}
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
          />
        </label>

        <label className="form-field">
          <span className="form-label">Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </label>

        <button type="submit" className="form-submit">Create Site</button>
      </form>
    </div>
  )
}
