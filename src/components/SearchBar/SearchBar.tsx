import { useState, useCallback, useEffect, useRef } from 'react'
import { searchByName, parseCoordinates } from '../../services/geocoding'
import type { SearchResult } from '../../types/map'
import './SearchBar.css'

interface SearchBarProps {
  onSelect: (result: SearchResult) => void
}

export function SearchBar({ onSelect }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback(
    async (value: string) => {
      if (!value.trim()) {
        setResults([])
        setIsOpen(false)
        return
      }

      const coords = parseCoordinates(value)
      if (coords) {
        setResults([
          {
            displayName: `${coords.latitude}, ${coords.longitude}`,
            latitude: coords.latitude,
            longitude: coords.longitude,
            boundingBox: null,
            type: 'coordinates',
          },
        ])
        setIsOpen(true)
        return
      }

      const searchResults = await searchByName(value)
      setResults(searchResults)
      setIsOpen(searchResults.length > 0)
    },
    []
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      handleSearch(query)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, handleSearch])

  const handleSelect = (result: SearchResult) => {
    setQuery(result.displayName)
    setIsOpen(false)
    onSelect(result)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const coords = parseCoordinates(query)
      if (coords) {
        handleSelect({
          displayName: `${coords.latitude}, ${coords.longitude}`,
          latitude: coords.latitude,
          longitude: coords.longitude,
          boundingBox: null,
          type: 'coordinates',
        })
      } else if (results.length > 0) {
        handleSelect(results[0])
      }
    }
  }

  return (
    <div className="search-bar">
      <div className="search-input-wrapper">
        <input
          type="text"
          placeholder="Search region name or enter lat, lon..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            className="search-clear"
            onClick={() => { setQuery(''); setResults([]); setIsOpen(false) }}
            aria-label="Clear search"
          >
            &times;
          </button>
        )}
      </div>
      {isOpen && results.length > 0 && (
        <div className="search-results">
          {results.map((result, index) => (
            <div
              key={index}
              className="search-result-item"
              onClick={() => handleSelect(result)}
            >
              {result.displayName}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
