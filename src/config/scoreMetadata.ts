export interface MetricDef {
  key: string
  label: string
  unit: string
  weight: number
  explanation: string
  computeSubScore: (value: number) => number
}

export interface CategoryMetadata {
  metrics: MetricDef[]
}

export const SCORE_METADATA: Record<string, CategoryMetadata> = {
  environmental: {
    metrics: [
      {
        key: 'avg_temp_c',
        label: 'Temperature',
        unit: '°C',
        weight: 0.30,
        explanation: 'Ideal range for outdoor equipment',
        computeSubScore: (v) => Math.max(0, 100 - Math.abs(v - 20) * 3.3),
      },
      {
        key: 'avg_precipitation_mm',
        label: 'Precipitation',
        unit: 'mm/day',
        weight: 0.30,
        explanation: 'Lower is better for RF and operations',
        computeSubScore: (v) => Math.max(0, 100 - v * 10),
      },
      {
        key: 'avg_solar_kwh_m2',
        label: 'Solar',
        unit: 'kWh/m²/day',
        weight: 0.20,
        explanation: 'Higher means off-grid power viable',
        computeSubScore: (v) => Math.min(100, (v * 100) / 6),
      },
      {
        key: 'avg_wind_speed_ms',
        label: 'Wind',
        unit: 'm/s',
        weight: 0.20,
        explanation: 'Moderate wind, good for dish stability',
        computeSubScore: (v) => (v <= 5 ? 100 : Math.max(0, 100 - (v - 5) * 6.67)),
      },
    ],
  },
  connectivity: {
    metrics: [
      {
        key: 'ixp_count_100km',
        label: 'IXPs within 100km',
        unit: '',
        weight: 0.50,
        explanation: 'More exchange points means better connectivity options',
        computeSubScore: (v) => Math.min(100, v * 20),
      },
      {
        key: 'nearest_ixp_km',
        label: 'Nearest IXP',
        unit: 'km',
        weight: 0.50,
        explanation: 'Closer IXPs mean lower latency and easier peering',
        computeSubScore: (v) => Math.max(0, 100 - v * 0.2),
      },
    ],
  },
}
