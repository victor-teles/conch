# SEC-004 validation

- Disposition: suppressed
- Method: code trace. `ChartStyle` interpolates only config keys and colors.
  Both callers (`card-chart.tsx`, `card-pie.tsx`) build keys as `s${index}`
  and colors from `seriesColor(index)`; labels from data are never put in the
  style text.
