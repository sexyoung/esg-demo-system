interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  formatter?: (v: number) => string;
  onChange: (v: number) => void;
}

export function SliderField({ label, value, min, max, step, unit, formatter, onChange }: Props) {
  const display = formatter ? formatter(value) : value.toLocaleString();
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm text-fg">{label}</span>
        <span className="tabular-nums text-sm font-semibold text-accent-soft">
          {display} <span className="text-fg-subtle text-xs ml-0.5">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-accent-soft"
      />
      <div className="flex justify-between text-[10px] text-fg-subtle mt-1 tabular-nums">
        <span>{formatter ? formatter(min) : min.toLocaleString()}</span>
        <span>{formatter ? formatter(max) : max.toLocaleString()}</span>
      </div>
    </label>
  );
}
