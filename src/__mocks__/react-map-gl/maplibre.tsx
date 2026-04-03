import { forwardRef } from 'react'

const Map = forwardRef(({ children, onClick, ...props }: Record<string, unknown>, ref) => (
  <div
    data-testid="map"
    ref={ref as React.Ref<HTMLDivElement>}
    onClick={(e) => {
      if (typeof onClick === 'function') {
        onClick({
          lngLat: { lng: 10.0, lat: 20.0 },
          originalEvent: e,
        })
      }
    }}
    {...props}
  >
    {children as React.ReactNode}
  </div>
))
Map.displayName = 'MockMap'

export default Map
export const NavigationControl = () => <div data-testid="navigation-control" />

export function Marker({
  children,
  longitude,
  latitude,
  onClick,
}: {
  children?: React.ReactNode
  longitude: number
  latitude: number
  anchor?: string
  onClick?: (e: { originalEvent: React.MouseEvent }) => void
}) {
  return (
    <div
      data-testid="marker"
      data-longitude={longitude}
      data-latitude={latitude}
      onClick={(e) => {
        e.stopPropagation()
        if (onClick) onClick({ originalEvent: e as unknown as React.MouseEvent })
      }}
    >
      {children}
    </div>
  )
}
