export const categories = [
  { id: "swe", label: "Software Engineering", color: "from-brand-500 to-violet-500" },
  { id: "dotnet", label: ".NET", color: "from-purple-500 to-fuchsia-500" },
  { id: "react", label: "React.js", color: "from-cyan-400 to-sky-500" },
  { id: "node", label: "Node.js", color: "from-emerald-400 to-teal-500" },
  { id: "hr", label: "HR Interview", color: "from-pink-500 to-rose-500" },
  { id: "behavioral", label: "Behavioral", color: "from-amber-400 to-orange-500" },
  { id: "leadership", label: "Leadership", color: "from-indigo-500 to-blue-500" },
];

export const difficulties = [
  { id: "beginner", label: "Beginner", color: "text-emerald-400" },
  { id: "intermediate", label: "Intermediate", color: "text-amber-400" },
  { id: "advanced", label: "Advanced", color: "text-rose-400" },
];

export const recentInterviews = [
  {
    id: "iv-1024",
    role: "Senior React Engineer",
    category: "React.js",
    difficulty: "Advanced",
    date: "2026-05-25T10:30:00Z",
    duration: 1820,
    score: 87,
    metrics: { technical: 88, communication: 84, clarity: 90, confidence: 82, depth: 89, pace: 86 },
    status: "completed",
  },
  {
    id: "iv-1023",
    role: ".NET Core Engineer",
    category: ".NET",
    difficulty: "Intermediate",
    date: "2026-05-23T15:10:00Z",
    duration: 1620,
    score: 79,
    metrics: { technical: 82, communication: 75, clarity: 80, confidence: 76, depth: 80, pace: 80 },
    status: "completed",
  },
  {
    id: "iv-1022",
    role: "HR Round – Tech Lead",
    category: "HR Interview",
    difficulty: "Intermediate",
    date: "2026-05-19T09:00:00Z",
    duration: 1240,
    score: 92,
    metrics: { technical: 90, communication: 95, clarity: 93, confidence: 92, depth: 90, pace: 91 },
    status: "completed",
  },
  {
    id: "iv-1021",
    role: "Behavioral – Conflict",
    category: "Behavioral",
    difficulty: "Beginner",
    date: "2026-05-15T18:00:00Z",
    duration: 980,
    score: 68,
    metrics: { technical: 60, communication: 70, clarity: 65, confidence: 72, depth: 64, pace: 75 },
    status: "completed",
  },
  {
    id: "iv-1020",
    role: "Node.js Backend",
    category: "Node.js",
    difficulty: "Advanced",
    date: "2026-05-12T13:30:00Z",
    duration: 2100,
    score: 84,
    metrics: { technical: 86, communication: 82, clarity: 80, confidence: 85, depth: 87, pace: 84 },
    status: "completed",
  },
];

export const trendSeries = [
  { label: "Mon", value: 62 },
  { label: "Tue", value: 71 },
  { label: "Wed", value: 65 },
  { label: "Thu", value: 80 },
  { label: "Fri", value: 78 },
  { label: "Sat", value: 88 },
  { label: "Sun", value: 87 },
];

export const skillRadar = [
  { label: "Technical", value: 85 },
  { label: "Communication", value: 78 },
  { label: "Clarity", value: 82 },
  { label: "Confidence", value: 70 },
  { label: "Depth", value: 80 },
  { label: "Pace", value: 86 },
];

export const upcomingPrompts = [
  {
    title: "Mock: Senior Frontend Engineer",
    desc: "Recommended based on last week's transcript.",
    duration: 30,
    tag: "React.js",
  },
  {
    title: "System Design: URL shortener",
    desc: "Practice trade-offs you missed in iv-1020.",
    duration: 45,
    tag: "System Design",
  },
  {
    title: "HR: Salary negotiation",
    desc: "Sharpen the closing minutes of HR rounds.",
    duration: 20,
    tag: "HR",
  },
];

export const interviewQuestions = {
  react: [
    "Walk me through how React reconciliation works.",
    "How would you optimize a list rendering thousands of items?",
    "Explain Suspense and concurrent rendering in your own words.",
    "How do you handle hydration mismatches in Next.js?",
    "Describe a hard React bug you've debugged. What did you learn?",
    "When would you reach for a state manager over local state + context?",
    "Tell me about a UI animation you're proud of.",
    "How do you test a complex hook?",
  ],
  swe: [
    "Tell me about your most complex production system.",
    "Walk me through a tricky concurrency bug you've solved.",
    "How do you keep code reviews from becoming political?",
    "Explain CAP theorem with a real product example.",
    "When have you intentionally chosen the worse solution? Why?",
  ],
  hr: [
    "Tell me a bit about yourself and your journey.",
    "Why are you looking to leave your current role?",
    "What does your ideal team look like?",
    "Where do you see yourself in three years?",
    "Tell me about a time you disagreed with your manager.",
  ],
  default: [
    "Could you start by introducing yourself?",
    "What got you interested in this role specifically?",
    "Walk me through a project you're proud of.",
    "Tell me about a time you failed and what you learned.",
    "Do you have any questions for me?",
  ],
};

export function pickQuestions(categoryId) {
  return interviewQuestions[categoryId] || interviewQuestions.default;
}
