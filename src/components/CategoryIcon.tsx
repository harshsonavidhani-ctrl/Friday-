import {
  AirVent,
  Cable,
  CookingPot,
  Fan,
  Headphones,
  Laptop,
  Microwave,
  Package,
  Plug,
  Refrigerator,
  Smartphone,
  Speaker,
  Tablet,
  Tv,
  WashingMachine,
  Watch,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  smartphone: Smartphone,
  tablet: Tablet,
  tv: Tv,
  microwave: Microwave,
  refrigerator: Refrigerator,
  "washing-machine": WashingMachine,
  "air-vent": AirVent,
  speaker: Speaker,
  headphones: Headphones,
  watch: Watch,
  laptop: Laptop,
  "cooking-pot": CookingPot,
  fan: Fan,
  cable: Cable,
  plug: Plug,
  package: Package,
};

export function CategoryIcon({ icon, className = "size-5" }: { icon?: string | null; className?: string }) {
  const Icon = (icon && ICONS[icon]) || Package;
  return <Icon className={className} strokeWidth={1.75} />;
}
