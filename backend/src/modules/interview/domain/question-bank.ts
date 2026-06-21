// Aligned with the proposal §3.1 — 6 primary tracks identified from the CV.
export const TRACKS = [
  { id: "software_engineering", label: "Software Engineering" },
  { id: "web_development", label: "Web Development" },
  { id: "data_science", label: "Data Science" },
  { id: "networking", label: "Networking" },
  { id: "ui_ux", label: "UI/UX" },
  { id: "business_analysis", label: "Business Analysis" },
] as const;

export type TrackId = (typeof TRACKS)[number]["id"];

export const QUESTION_BANK: Record<string, string[]> = {
  software_engineering: [
    "Could you start by introducing yourself and your background?",
    "Walk me through the most complex production system you've worked on.",
    "Tell me about a tricky concurrency or race-condition bug you've solved.",
    "Explain CAP theorem with a real product example.",
    "How do you decide between SQL and NoSQL for a new service?",
    "Describe a time you intentionally chose the worse solution. Why?",
    "How do you keep code reviews productive instead of political?",
    "What does production-ready mean to you?",
  ],
  web_development: [
    "Tell me about yourself and your work on the web.",
    "Walk me through how the browser renders a page from HTML to pixels.",
    "How would you optimize a list rendering tens of thousands of items?",
    "Explain hydration and how to fix mismatches in SSR frameworks.",
    "When would you reach for an external state manager over local state + context?",
    "How do you measure and improve Core Web Vitals?",
    "Describe a hard UI bug you've debugged and what you learned.",
    "How do you approach testing a complex custom hook or component?",
  ],
  data_science: [
    "Could you walk me through your data science journey?",
    "Explain the bias-variance trade-off with an example.",
    "How do you handle class imbalance in a real dataset?",
    "Describe an A/B test you've designed end-to-end.",
    "Walk me through your feature-engineering process for a regression problem.",
    "How do you evaluate a model beyond accuracy?",
    "Tell me about a time your model failed in production. What did you do?",
    "Explain how you'd productionize a model — from notebook to serving.",
  ],
  networking: [
    "Tell me about your networking background.",
    "Walk through what happens when a packet leaves your laptop heading to google.com.",
    "Explain the difference between TCP and UDP with a use case for each.",
    "How does TLS 1.3 differ from 1.2 at a high level?",
    "How would you debug a connection that drops every 60 seconds?",
    "Explain BGP and why route flapping is dangerous.",
    "Tell me about a time you mitigated a DDoS or noisy-neighbor issue.",
    "How do you approach zero-trust network design?",
  ],
  ui_ux: [
    "Introduce yourself and the kind of design work you love.",
    "Walk me through your design process from brief to handoff.",
    "Tell me about a usability test that completely changed your design.",
    "How do you balance brand consistency with platform conventions?",
    "Describe a design system you've contributed to and the trade-offs you made.",
    "How do you validate accessibility (a11y) beyond color contrast?",
    "Walk me through a portfolio piece you're proud of.",
    "How do you push back when stakeholders disagree with your design?",
  ],
  business_analysis: [
    "Could you tell me about your background in business analysis?",
    "Walk me through how you elicit requirements from a non-technical stakeholder.",
    "Describe a time the stated requirement was wrong. How did you find out?",
    "How do you write a good user story and acceptance criteria?",
    "Explain how you'd prioritize a backlog with 50 items and 1 engineering team.",
    "Tell me about a stakeholder conflict you resolved.",
    "How do you measure the success of a feature post-launch?",
    "Describe your favorite framework for process mapping and why.",
  ],
};

export const PHASES = [
  "greet",
  "intro",
  "tech",
  "follow",
  "behavior",
  "wrap",
] as const;

export function pickQuestions(category: string): string[] {
  // accept legacy ids too
  const legacy: Record<string, string> = {
    swe: "software_engineering",
    react: "web_development",
    node: "software_engineering",
    dotnet: "software_engineering",
    hr: "business_analysis",
    behavioral: "software_engineering",
    leadership: "software_engineering",
  };
  const id = QUESTION_BANK[category] ? category : (legacy[category] ?? "software_engineering");
  return QUESTION_BANK[id].slice();
}

export function phaseFor(ordinal: number, total: number): (typeof PHASES)[number] {
  const ratio = total === 0 ? 0 : ordinal / total;
  if (ratio < 0.15) return "greet";
  if (ratio < 0.3) return "intro";
  if (ratio < 0.6) return "tech";
  if (ratio < 0.8) return "follow";
  if (ratio < 0.95) return "behavior";
  return "wrap";
}
