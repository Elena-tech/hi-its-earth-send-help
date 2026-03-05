export interface ClimateEvent {
  year: number;
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  pauseMs: number; // how long to pause auto-play on this event
}

export const CLIMATE_EVENTS: ClimateEvent[] = [
  {
    year: 1896,
    title: "The First Warning",
    body: "Swedish scientist Svante Arrhenius calculates that doubling CO₂ could warm Earth by 5–6°C. Nobody listens.",
    severity: "info",
    pauseMs: 3500,
  },
  {
    year: 1938,
    title: "Callendar's Discovery",
    body: "Engineer Guy Callendar links rising CO₂ to rising temperatures using 147 weather stations. Dismissed as unlikely.",
    severity: "info",
    pauseMs: 3000,
  },
  {
    year: 1958,
    title: "The Keeling Curve Begins",
    body: "Charles Keeling starts measuring CO₂ at Mauna Loa, Hawaii. First reading: 315 ppm. This graph will become the most important in history.",
    severity: "info",
    pauseMs: 3500,
  },
  {
    year: 1969,
    title: "Earthrise",
    body: "Apollo astronauts photograph Earth from the Moon. For the first time, humanity sees the fragility of the pale blue dot it calls home.",
    severity: "info",
    pauseMs: 3500,
  },
  {
    year: 1972,
    title: "Stockholm Conference",
    body: "The United Nations holds its first global environment conference. 113 nations attend. The environmental era begins.",
    severity: "info",
    pauseMs: 3000,
  },
  {
    year: 1988,
    title: "Hansen Warns Congress",
    body: "NASA scientist James Hansen testifies to the US Senate: \"The greenhouse effect has been detected and is changing our climate now.\" The world watches — then forgets.",
    severity: "warning",
    pauseMs: 4500,
  },
  {
    year: 1988,
    title: "IPCC Founded",
    body: "The Intergovernmental Panel on Climate Change is established to assess the science. Their first report will take 2 years. Their warnings will take decades to act on.",
    severity: "info",
    pauseMs: 3000,
  },
  {
    year: 1992,
    title: "Earth Summit",
    body: "172 nations gather in Rio de Janeiro. The UN Framework Convention on Climate Change is adopted. Politicians shake hands. Emissions keep rising.",
    severity: "warning",
    pauseMs: 3500,
  },
  {
    year: 1997,
    title: "Kyoto Protocol",
    body: "37 industrialised nations commit to cutting emissions. The US — the world's biggest emitter — refuses to ratify. Emissions keep rising.",
    severity: "warning",
    pauseMs: 4000,
  },
  {
    year: 2005,
    title: "Kyoto Enters Force",
    body: "After years of delay, Kyoto Protocol finally takes legal effect. Global CO₂ is already at 380 ppm — 100 ppm above pre-industrial levels.",
    severity: "warning",
    pauseMs: 3000,
  },
  {
    year: 2007,
    title: "\"Unequivocal\"",
    body: "IPCC Fourth Assessment Report: warming of the climate system is \"unequivocal\". The IPCC and Al Gore share the Nobel Peace Prize. CO₂ hits 384 ppm.",
    severity: "warning",
    pauseMs: 3500,
  },
  {
    year: 2012,
    title: "Arctic Ice Record Low",
    body: "Arctic sea ice shrinks to its smallest recorded extent — 3.4 million km². Half what it was in 1980. Scientists are alarmed.",
    severity: "critical",
    pauseMs: 4000,
  },
  {
    year: 2015,
    title: "Paris Agreement",
    body: "195 nations agree to limit warming to 1.5°C above pre-industrial levels. A historic moment. Current pledges put us on track for 2.7°C.",
    severity: "warning",
    pauseMs: 4500,
  },
  {
    year: 2018,
    title: "Greta Thunberg",
    body: "A 15-year-old Swedish student sits outside the Swedish parliament with a sign: \"Skolstrejk för klimatet.\" Within months, millions are striking worldwide.",
    severity: "info",
    pauseMs: 3500,
  },
  {
    year: 2019,
    title: "The Amazon Burns",
    body: "Record fires devastate the Amazon — the Earth's largest rainforest and a critical carbon sink. 900,000 hectares lost in a single month.",
    severity: "critical",
    pauseMs: 4000,
  },
  {
    year: 2021,
    title: "\"Code Red for Humanity\"",
    body: "IPCC Sixth Assessment Report. UN Secretary-General calls it a \"code red for humanity\". Many of the changes are now irreversible. CO₂: 416 ppm.",
    severity: "critical",
    pauseMs: 4500,
  },
  {
    year: 2023,
    title: "Hottest Year in Recorded History",
    body: "2023 shatters every temperature record. Every single day is warmer than the same day in any previous year. CO₂: 421 ppm.",
    severity: "critical",
    pauseMs: 4000,
  },
  {
    year: 2024,
    title: "1.5°C Crossed",
    body: "For the first time, Earth's average temperature exceeds 1.5°C above pre-industrial levels for a full calendar year — the Paris Agreement threshold. You are here.",
    severity: "critical",
    pauseMs: 5000,
  },
];

export function getEventsForYear(year: number): ClimateEvent[] {
  return CLIMATE_EVENTS.filter(e => Math.abs(e.year - year) < 0.5);
}
