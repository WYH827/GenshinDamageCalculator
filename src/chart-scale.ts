export function damageScale(values: number[]) {
  const maximum = values.reduce(
    (max, value) => (Number.isFinite(value) ? Math.max(max, value) : max),
    0,
  );
  if (maximum <= 0) return { max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
  const raw = maximum / 4,
    power = 10 ** Math.floor(Math.log10(raw)),
    fraction = raw / power;
  const step = ([1, 2, 2.5, 5, 10].find((n) => n >= fraction) ?? 10) * power;
  const max = Math.ceil(maximum / step) * step;
  if (!Number.isFinite(max) || step === 0)
    return {
      max: maximum,
      ticks: [0, maximum / 4, maximum / 2, maximum * 0.75, maximum],
    };
  return {
    max,
    ticks: Array.from({ length: Math.round(max / step) + 1 }, (_, i) =>
      Number((i * step).toPrecision(12)),
    ),
  };
}
