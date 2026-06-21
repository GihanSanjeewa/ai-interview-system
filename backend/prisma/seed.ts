import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const sampleJobs = [
  {
    title: "Senior React Engineer",
    company: "Loft Labs",
    location: "Colombo, Sri Lanka",
    remote: true,
    seniority: "Senior",
    description:
      "Lead the architecture of our Next.js platform. Mentor junior engineers, own performance budgets, ship measurable wins each sprint.",
    skills: ["React", "TypeScript", "Next.js", "Node.js", "TanStack Query", "Testing"],
    sourceUrl: "https://example.com/jobs/sre-001",
  },
  {
    title: ".NET Core Backend Engineer",
    company: "Sysco LABS",
    location: "Colombo, Sri Lanka",
    remote: false,
    seniority: "Mid",
    description:
      "Build APIs on ASP.NET Core, EF Core, and Azure. Optimize hot paths, ship resilient services, deliver on SLOs.",
    skills: [".NET", "C#", "ASP.NET Core", "EF Core", "Azure", "SQL"],
    sourceUrl: "https://example.com/jobs/dotnet-002",
  },
  {
    title: "Frontend Engineer (Junior)",
    company: "WSO2",
    location: "Remote",
    remote: true,
    seniority: "Junior",
    description:
      "Help build internal tools used by hundreds of engineers. Pair with seniors on tricky UI problems and ship weekly.",
    skills: ["React", "TypeScript", "CSS", "HTML", "Git"],
    sourceUrl: "https://example.com/jobs/feeng-003",
  },
  {
    title: "Node.js Platform Engineer",
    company: "99x",
    location: "Colombo, Sri Lanka",
    remote: true,
    seniority: "Senior",
    description:
      "Own platform reliability for our Node.js fleet. Improve observability, kill latency tail spikes, mentor.",
    skills: ["Node.js", "TypeScript", "Kubernetes", "Postgres", "Redis", "OpenTelemetry"],
    sourceUrl: "https://example.com/jobs/node-004",
  },
  {
    title: "Tech Lead — Full Stack",
    company: "IFS",
    location: "Hybrid · Colombo",
    remote: false,
    seniority: "Lead",
    description:
      "Lead a 6-person full-stack team. Set the technical bar, run reviews, deliver business outcomes.",
    skills: ["React", "Node.js", "TypeScript", ".NET", "AWS", "Leadership"],
    sourceUrl: "https://example.com/jobs/lead-005",
  },
  {
    title: "Junior Software Engineer",
    company: "Inverview Labs",
    location: "Remote",
    remote: true,
    seniority: "Junior",
    description:
      "Join our small team. Touch the whole stack, learn from senior reviewers, ship every week.",
    skills: ["JavaScript", "React", "Node.js", "SQL", "Git"],
    sourceUrl: "https://example.com/jobs/jr-006",
  },
];

async function main() {
  for (const job of sampleJobs) {
    await prisma.job.upsert({
      where: { externalId: job.sourceUrl },
      update: {},
      create: { ...job, externalId: job.sourceUrl },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${sampleJobs.length} jobs.`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
