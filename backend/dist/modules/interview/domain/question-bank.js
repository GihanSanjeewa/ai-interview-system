"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PHASES = exports.QUESTION_BANK = void 0;
exports.pickQuestions = pickQuestions;
exports.phaseFor = phaseFor;
exports.QUESTION_BANK = {
    react: [
        "Could you start by introducing yourself and your work with React?",
        "Walk me through how React's reconciliation algorithm works.",
        "How would you optimize a list rendering tens of thousands of items?",
        "Explain Suspense and concurrent rendering in your own words.",
        "How do you handle hydration mismatches in a Next.js application?",
        "Describe a hard React bug you've debugged. What did you learn from it?",
        "When would you reach for an external state manager over local state + context?",
        "How do you approach testing a complex custom hook?",
    ],
    swe: [
        "Tell me about your most complex production system.",
        "Walk me through a tricky concurrency bug you've solved.",
        "How do you keep code reviews productive instead of political?",
        "Explain CAP theorem with a real product example.",
        "When have you intentionally chosen the worse solution? Why?",
    ],
    dotnet: [
        "Tell me about your experience with .NET Core.",
        "Explain dependency injection in ASP.NET Core.",
        "How does EF Core change tracking work?",
        "Walk me through securing a Web API using JWT.",
        "Describe a performance issue you fixed in a .NET service.",
    ],
    node: [
        "Walk me through Node.js' event loop.",
        "How do you scale a Node service handling 10k concurrent connections?",
        "Explain the trade-offs between Express, Fastify and NestJS.",
        "Describe a memory leak you've debugged in production.",
        "How do you secure a Node API against the OWASP Top 10?",
    ],
    hr: [
        "Tell me a bit about yourself and your journey.",
        "Why are you looking to leave your current role?",
        "What does your ideal team look like?",
        "Where do you see yourself in three years?",
        "Tell me about a time you disagreed with your manager.",
    ],
    behavioral: [
        "Tell me about a time you failed.",
        "Describe a conflict with a teammate and how you resolved it.",
        "Tell me about a time you had to make a decision without enough data.",
        "Describe a time you advocated for an unpopular position.",
        "Tell me about your proudest professional achievement.",
    ],
    leadership: [
        "How do you set vision for a team of 10+ engineers?",
        "Walk me through a hiring decision you led.",
        "Tell me about a low-performer you turned around — or had to let go.",
        "How do you measure engineering productivity?",
        "Describe a strategic bet you made that didn't pay off.",
    ],
};
exports.PHASES = [
    "greet",
    "intro",
    "tech",
    "follow",
    "behavior",
    "wrap",
];
function pickQuestions(category) {
    const list = exports.QUESTION_BANK[category] ?? exports.QUESTION_BANK.swe;
    return list.slice();
}
function phaseFor(ordinal, total) {
    const ratio = total === 0 ? 0 : ordinal / total;
    if (ratio < 0.15)
        return "greet";
    if (ratio < 0.3)
        return "intro";
    if (ratio < 0.6)
        return "tech";
    if (ratio < 0.8)
        return "follow";
    if (ratio < 0.95)
        return "behavior";
    return "wrap";
}
//# sourceMappingURL=question-bank.js.map