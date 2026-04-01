import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MapView } from './MapView'

describe('MapView', () => {
  it('renders the map container', () => {
    render(
      <MapView
        viewState={{ longitude: 0, latitude: 20, zoom: 2 }}
        onViewStateChange={() => {}}
      />
    )
    const container = document.querySelector('.map-container')
    expect(container).toBeInTheDocument()
  })
})
