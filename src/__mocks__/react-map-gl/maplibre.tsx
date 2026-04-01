import { forwardRef } from 'react'

const Map = forwardRef(({ children, ...props }: Record<string, unknown>, ref) => (
  <div data-testid="map" ref={ref as React.Ref<HTMLDivElement>} {...props}>
    {children as React.ReactNode}
  </div>
))
Map.displayName = 'MockMap'

export default Map
export const NavigationControl = () => <div data-testid="navigation-control" />
