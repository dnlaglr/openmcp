import { RadioGroup } from "@base-ui/react/radio-group";
import { Radio } from "@base-ui/react/radio";
import { cn } from "cn";

type Theme = "system" | "light" | "dark";

const choices: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" }
];

const palettes = {
  light: "[--ts:oklch(0.955_0.01_255)] [--tm:oklch(1_0_0)] [--tr:oklch(0.9_0.012_255)]",
  dark: "[--ts:oklch(0.2_0.022_262)] [--tm:oklch(0.17_0.02_262)] [--tr:oklch(0.3_0.022_262)]"
};

function Window({ theme, half = false }: { theme: "light" | "dark"; half?: boolean }) {
  return (
    <span
      className={cn("absolute inset-0 flex bg-(--tm)", palettes[theme])}
      style={half ? { clipPath: "polygon(58% 0, 100% 0, 100% 100%, 42% 100%)" } : undefined}
    >
      <span className="w-[28%] bg-(--ts)" />
      <span className="flex flex-1 flex-col gap-[5px] px-[7px] py-2">
        <span className="h-1.5 w-[55%] rounded-full bg-primary" />
        <span className="h-[5px] rounded-full bg-(--tr)" />
        <span className="h-[5px] w-[68%] rounded-full bg-(--tr)" />
      </span>
    </span>
  );
}

export function ThemePicker({ value, onChange }: { value: Theme; onChange: (value: Theme) => void }) {
  return (
    <RadioGroup
      aria-label="Theme"
      value={value}
      onValueChange={(next) => onChange(next as Theme)}
      className="flex gap-4"
    >
      {choices.map((choice) => (
        <label key={choice.value} className="group flex flex-col items-center gap-[7px] text-[12.5px]">
          <Radio.Root
            value={choice.value}
            className="relative h-[68px] w-[104px] overflow-hidden rounded-[9px] ring-1 ring-border transition-[box-shadow,transform] duration-(--d3) ease-(--spring) outline-none group-hover:-translate-y-0.5 data-checked:ring-2 data-checked:ring-primary data-checked:shadow-[0_0_0_5px_color-mix(in_oklch,var(--primary)_22%,transparent)] focus-visible:focus-halo"
          >
            <Window theme={choice.value === "dark" ? "dark" : "light"} />
            {choice.value === "system" && <Window theme="dark" half />}
          </Radio.Root>
          <span className={cn(value === choice.value ? "font-semibold" : "text-muted-foreground")}>{choice.label}</span>
        </label>
      ))}
    </RadioGroup>
  );
}
