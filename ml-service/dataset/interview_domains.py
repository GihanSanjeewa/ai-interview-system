"""The 16 interview domains, their keyword signatures and the difficulty rules.

Single source of truth for `prepare_question_generator.py`, the notebook in
`notebooks/question_generator_data_preprocessing.ipynb` and anything else that
has to speak the same taxonomy.

Provenance of the 16 names — none of them are invented here:

  * 1-14 are the Stack Exchange filter tags already written down in
    `DATASETS.md` §A ("Filter Stack Exchange down to your 16 domains by tag:
    sql, indexing, oop, design-patterns, microservices, docker, kubernetes,
    rest, concurrency, algorithm, data-structures, security, unit-testing,
    system-design").
  * 15-16 are the two remaining dataset categories from
    `AI_Interview_Assistant_Research_Plan.md` §6.1 ("Frontend: React, Angular,
    State management" and "Programming: Java, Python, PHP, JavaScript").

`DATASETS.md` refers to "the 16-category JSON schema" but never enumerated the
list; this module is that enumeration.
"""
from __future__ import annotations

import re

# ── Domains ───────────────────────────────────────────────────────────────────
# Display name -> canonical slug. Display names are what lands in the `domain`
# field of the processed records; slugs are used for filenames and stats keys.
DOMAINS: dict[str, str] = {
    "SQL": "sql",
    "Database Optimization": "database-optimization",
    "OOP": "oop",
    "Design Patterns": "design-patterns",
    "Microservices": "microservices",
    "Docker": "docker",
    "Kubernetes": "kubernetes",
    "REST APIs": "rest",
    "Concurrency": "concurrency",
    "Algorithms": "algorithms",
    "Data Structures": "data-structures",
    "Security": "security",
    "Unit Testing": "unit-testing",
    "System Design": "system-design",
    "Frontend Development": "frontend",
    "Programming Languages": "programming-languages",
}

DOMAIN_NAMES: list[str] = list(DOMAINS)
assert len(DOMAIN_NAMES) == 16, "the taxonomy must stay at 16 domains"

DIFFICULTIES: list[str] = ["Beginner", "Intermediate", "Advanced"]

# ── Domain keyword signatures ────────────────────────────────────────────────
# Weighted term lists. `strong` terms are near-unambiguous for the domain,
# `weak` terms only nudge. Scoring lives in `classify_domain` below.
DOMAIN_KEYWORDS: dict[str, dict[str, list[str]]] = {
    "SQL": {
        "strong": ["sql", "inner join", "left join", "outer join", "group by",
                   "having clause", "subquery", "stored procedure", "normalization",
                   "third normal form", "primary key", "foreign key", "acid",
                   "isolation level", "sql injection", "cte", "window function"],
        "weak": ["query", "table", "select", "database", "postgres", "postgresql",
                 "mysql", "oracle", "sqlite", "mariadb", "t-sql", "plsql", "schema",
                 "relational", "transaction", "rollback", "commit"],
    },
    "Database Optimization": {
        "strong": ["index", "indexing", "clustered index", "query plan",
                   "execution plan", "query optimization", "query optimisation",
                   "seq scan", "full table scan", "cardinality estimate", "vacuum",
                   "partitioning", "sharding", "denormalization", "explain analyze"],
        "weak": ["slow query", "performance", "cache", "replication", "throughput",
                 "buffer pool", "statistics", "tuning", "bottleneck"],
    },
    "OOP": {
        "strong": ["object oriented", "object-oriented", "polymorphism",
                   "encapsulation", "inheritance", "abstract class", "interface segregation",
                   "liskov", "solid principle", "solid principles", "composition over inheritance",
                   "method overriding", "method overloading", "virtual method"],
        "weak": ["class", "subclass", "superclass", "constructor", "instance",
                 "abstraction", "coupling", "cohesion", "oop"],
    },
    "Design Patterns": {
        "strong": ["design pattern", "singleton", "factory pattern", "abstract factory",
                   "builder pattern", "observer pattern", "strategy pattern",
                   "decorator pattern", "adapter pattern", "facade pattern",
                   "command pattern", "repository pattern", "dependency injection",
                   "inversion of control", "mvc", "mvvm", "anti-pattern"],
        "weak": ["pattern", "refactor", "refactoring", "gof", "gang of four",
                 "clean architecture", "hexagonal"],
    },
    "Microservices": {
        "strong": ["microservice", "microservices", "service mesh", "saga pattern",
                   "api gateway", "event-driven architecture", "message broker",
                   "service discovery", "circuit breaker", "bounded context",
                   "eventual consistency", "monolith to microservices"],
        "weak": ["kafka", "rabbitmq", "grpc", "monolith", "distributed", "soa",
                 "event sourcing", "cqrs", "consul", "istio"],
    },
    "Docker": {
        "strong": ["docker", "dockerfile", "docker-compose", "docker compose",
                   "container image", "docker image", "containerization",
                   "containerisation", "multi-stage build", "docker volume",
                   "docker network", "oci image", "podman"],
        "weak": ["container", "image layer", "registry", "entrypoint", "buildkit"],
    },
    "Kubernetes": {
        "strong": ["kubernetes", "kubectl", "k8s", "helm chart", "kubelet",
                   "statefulset", "daemonset", "replicaset", "ingress controller",
                   "persistent volume claim", "configmap", "kube-proxy", "openshift"],
        "weak": ["pod", "namespace", "cluster", "helm", "node affinity", "sidecar",
                 "orchestration", "autoscaling"],
    },
    "REST APIs": {
        "strong": ["rest api", "restful", "http verb", "idempotent", "status code",
                   "http status", "graphql", "openapi", "swagger", "oauth2 flow",
                   "jwt token", "content negotiation", "hateoas", "api versioning"],
        "weak": ["endpoint", "api", "http", "json response", "webhook", "cors",
                 "put request", "post request", "bearer token", "rate limit"],
    },
    "Concurrency": {
        "strong": ["concurrency", "race condition", "deadlock", "mutex", "semaphore",
                   "thread safe", "thread-safe", "critical section", "atomic operation",
                   "livelock", "lock contention", "memory barrier", "async await",
                   "goroutine", "coroutine", "parallelism"],
        "weak": ["thread", "threading", "lock", "synchronization", "synchronisation",
                 "multithreaded", "concurrent", "asynchronous", "event loop", "future",
                 "promise"],
    },
    "Algorithms": {
        "strong": ["time complexity", "space complexity", "big o", "dynamic programming",
                   "greedy algorithm", "divide and conquer", "backtracking",
                   "shortest path", "dijkstra", "breadth-first", "depth-first",
                   "np-complete", "np-hard", "sorting algorithm", "binary search",
                   "amortized"],
        "weak": ["algorithm", "recursion", "asymptotic", "heuristic", "traversal",
                 "optimal solution", "brute force", "memoization", "complexity"],
    },
    "Data Structures": {
        "strong": ["data structure", "linked list", "binary tree", "binary search tree",
                   "hash table", "hash map", "priority queue", "red-black tree",
                   "b-tree", "trie", "adjacency list", "circular buffer", "skip list",
                   "disjoint set", "union find"],
        "weak": ["array", "stack", "queue", "heap", "graph", "tree", "set", "map",
                 "dictionary", "list", "node", "pointer"],
    },
    "Security": {
        "strong": ["xss", "cross-site scripting", "csrf", "sql injection",
                   "owasp", "penetration test", "vulnerability", "encryption",
                   "hashing password", "bcrypt", "argon2", "tls", "ssl certificate",
                   "man in the middle", "privilege escalation", "authentication bypass",
                   "zero trust", "threat model"],
        "weak": ["security", "attacker", "exploit", "secure", "authorization",
                 "authentication", "credential", "cipher", "salt", "firewall",
                 "sanitize", "cve"],
    },
    "Unit Testing": {
        "strong": ["unit test", "unit testing", "test driven development", "tdd",
                   "mock object", "stub", "test double", "code coverage",
                   "integration test", "junit", "pytest", "jest", "nunit", "mockito",
                   "test pyramid", "regression test", "test fixture"],
        "weak": ["testing", "test case", "qa", "automated test", "e2e", "selenium",
                 "cypress", "flaky test", "spy", "assertion", "assert"],
    },
    "System Design": {
        "strong": ["system design", "scalability", "load balancer", "horizontal scaling",
                   "vertical scaling", "cap theorem", "high availability",
                   "fault tolerance", "caching strategy", "rate limiting",
                   "consistent hashing", "capacity planning", "design a system",
                   "architecture trade-off", "disaster recovery"],
        "weak": ["architecture", "scale", "throughput", "latency", "redis",
                 "memcached", "cdn", "replica", "failover", "queue", "availability"],
    },
    "Frontend Development": {
        "strong": ["react", "reactjs", "angular", "vue", "vuejs", "svelte",
                   "virtual dom", "react hook", "usestate", "useeffect", "jsx",
                   "component lifecycle", "state management", "redux", "vuex",
                   "css grid", "flexbox", "responsive design", "web accessibility",
                   "server side rendering", "single page application"],
        "weak": ["frontend", "front-end", "browser", "dom", "css", "html",
                 "javascript", "typescript", "ui", "template", "directive",
                 "webpack", "bundler", "styling"],
    },
    "Programming Languages": {
        "strong": ["garbage collection", "memory management", "type system",
                   "static typing", "dynamic typing", "closure", "immutability",
                   "generics", "lambda expression", "functional programming",
                   "pass by reference", "pass by value", "compiler", "interpreter",
                   "stack vs heap", "reflection api"],
        "weak": ["java", "python", "php", "c#", "c++", "golang", "rust", "ruby",
                 "kotlin", "scala", "syntax", "idiomatic", "language feature",
                 "runtime", "exception handling"],
    },
}

# ── Site / prompt hints ──────────────────────────────────────────────────────
# Stack Exchange site -> domains the site is a-priori biased towards. Applied as
# a small prior on top of the keyword score, never as an override, so that a
# Kubernetes question asked on dba.stackexchange.com still lands in Kubernetes.
SITE_DOMAIN_PRIOR: dict[str, list[str]] = {
    "softwareengineering.stackexchange.com": ["OOP", "Design Patterns", "System Design",
                                              "Microservices", "REST APIs",
                                              "Programming Languages"],
    "codereview.stackexchange.com": ["OOP", "Programming Languages", "Design Patterns",
                                     "Unit Testing"],
    "cs.stackexchange.com": ["Algorithms", "Data Structures", "Concurrency"],
    "cstheory.stackexchange.com": ["Algorithms", "Data Structures"],
    "dba.stackexchange.com": ["SQL", "Database Optimization"],
    "devops.stackexchange.com": ["Docker", "Kubernetes", "Microservices", "System Design"],
    "security.stackexchange.com": ["Security"],
    "sqa.stackexchange.com": ["Unit Testing"],
}

# `input` prompt fragments in ali-alkhars/interviews -> domain prior.
PROMPT_DOMAIN_PRIOR: dict[str, list[str]] = {
    "javascript": ["Frontend Development", "Programming Languages"],
    "react": ["Frontend Development"],
    "vue": ["Frontend Development"],
    "angular": ["Frontend Development"],
    "css": ["Frontend Development"],
    "front-end": ["Frontend Development"],
    "frontend": ["Frontend Development"],
    "java": ["Programming Languages", "OOP"],
    "back-end": ["REST APIs", "System Design", "Microservices"],
    "backend": ["REST APIs", "System Design", "Microservices"],
    "devops": ["Docker", "Kubernetes"],
    "system design": ["System Design"],
    "database": ["SQL", "Database Optimization"],
    "sql": ["SQL"],
    "python": ["Programming Languages"],
    "node": ["REST APIs", "Programming Languages"],
    "testing": ["Unit Testing"],
    "security": ["Security"],
}

PRIOR_WEIGHT = 1.0      # bonus added to a domain named by the site prior
PROMPT_PRIOR_WEIGHT = 3.0  # ali-alkhars prompts name the topic outright
STRONG_WEIGHT = 3.0
WEAK_WEIGHT = 1.0
MIN_DOMAIN_SCORE = 3.0  # below this the record is "off-domain" and gets dropped

_WORD_RE = re.compile(r"[a-z0-9+#.\-]+")


def _normalise(text: str) -> str:
    return " " + " ".join(_WORD_RE.findall(text.lower())) + " "


def score_domains(text: str, priors: list[str] | None = None,
                  prior_weight: float = PRIOR_WEIGHT) -> dict[str, float]:
    """Keyword score for every domain. Higher is a better match."""
    hay = _normalise(text)
    scores: dict[str, float] = {}
    for domain, groups in DOMAIN_KEYWORDS.items():
        score = 0.0
        for term in groups["strong"]:
            if f" {term} " in hay:
                score += STRONG_WEIGHT
        for term in groups["weak"]:
            if f" {term} " in hay:
                score += WEAK_WEIGHT
        scores[domain] = score
    for domain in priors or []:
        if domain in scores:
            scores[domain] += prior_weight
    return scores


def classify_domain(text: str, priors: list[str] | None = None,
                    prior_weight: float = PRIOR_WEIGHT) -> tuple[str | None, float]:
    """Return (domain, score) or (None, score) when nothing clears the threshold.

    Deterministic: ties break on the fixed DOMAIN_NAMES order. `prior_weight` is
    raised for ali-alkhars/interviews, where the source prompt literally names
    the topic ("I need Vue interview questions") and is therefore hard evidence
    rather than a nudge.
    """
    scores = score_domains(text, priors, prior_weight)
    best = max(DOMAIN_NAMES, key=lambda d: (scores[d], -DOMAIN_NAMES.index(d)))
    return (best if scores[best] >= MIN_DOMAIN_SCORE else None), scores[best]


def site_priors(site: str) -> list[str]:
    return SITE_DOMAIN_PRIOR.get(site, [])


def prompt_priors(prompt: str) -> list[str]:
    low = (prompt or "").lower()
    out: list[str] = []
    for fragment, domains in PROMPT_DOMAIN_PRIOR.items():
        if fragment in low:
            out.extend(domains)
    return out


# ── Difficulty ───────────────────────────────────────────────────────────────
# Deterministic and rule based — no sampling, no model call, same input always
# gives the same label.
#
# difficulty = f(question form, concept depth)
#
#   question form  — what the question asks the candidate to *do*, in the spirit
#                    of Bloom's taxonomy: recall (1), apply (2), analyse (3).
#   concept depth  — how advanced the *subject* is: introductory vocabulary (1),
#                    everyday professional vocabulary (2), or distributed-systems
#                    / concurrency / optimisation vocabulary (3).
#
# The two are summed, nudged by a few density signals, and cut at fixed
# thresholds. This matches the brief directly: "basic definitions -> Beginner,
# practical implementation/troubleshooting -> Intermediate, architecture,
# optimization, trade-offs, complex algorithms -> Advanced".

# Form 3 — analysis, design, trade-offs, optimisation.
FORM_DESIGN = [
    "design", "architect", "trade-off", "tradeoff", "trade off", "pros and cons",
    "advantages and disadvantages", "why does", "why is", "why do", "compare",
    "when not to", "best strategy", "scale", "scaling", "optimi", "optimis",
    "improve performance", "would you", "how would", "what happens when",
    "under the hood", "internals", "better approach", "which is faster",
    "more efficient", "reduce latency", "handle failure", "at scale",
]
# Form 2 — application, implementation, troubleshooting.
FORM_PRACTICAL = [
    "how do i", "how to", "how can i", "how do you", "best way to",
    "best practice", "should i", "is it possible", "implement", "configure",
    "troubleshoot", "debug", "fix", "handle", "migrate", "set up", "setup",
    "integrate", "when should", "when to use", "can i use", "is there a way",
    "prevent", "avoid", "ensure", "validate", "write a", "create a", "build a",
]
# Form 1 — recall / definition.
FORM_DEFINITION = [
    "what is", "what are", "define", "definition of", "what does", "meaning of",
    "difference between", "explain", "describe", "list", "name the", "types of",
    "purpose of", "used for", "what's the", "whats the", "what do you mean",
    "who ", "when was",
]

# Concept depth 3 — the vocabulary of senior-level engineering.
DEPTH_ADVANCED = [
    "cap theorem", "eventual consistency", "consensus", "raft", "paxos",
    "sharding", "shard", "partition tolerance", "lock-free", "lock free",
    "memory barrier", "memory model", "race condition", "deadlock", "livelock",
    "garbage collect", "jit", "query plan", "execution plan", "isolation level",
    "mvcc", "np-complete", "np-hard", "amortized", "asymptotic",
    "dynamic programming", "red-black", "b-tree", "trie", "consistent hashing",
    "circuit breaker", "saga pattern", "service mesh", "event sourcing", "cqrs",
    "bounded context", "zero trust", "threat model", "side channel",
    "timing attack", "back pressure", "backpressure", "throughput", "latency",
    "load balanc", "autoscal", "high availability", "fault toleran",
    "disaster recovery", "distributed", "scalab", "concurrency", "concurrent",
    "parallelism", "profiling", "benchmark", "bottleneck", "replication lag",
    "idempoten", "immutab", "type system", "covarian", "reflection",
    "metaprogramming", "virtual dom", "hydration", "server side rendering",
    "server-side rendering", "code splitting", "tree shaking", "memoization",
    "dependency inversion", "liskov", "hexagonal", "clean architecture",
    "microservice", "statefulset", "service discovery", "sidecar", "istio",
    "mutual tls", "oauth", "csrf", "xss", "sql injection", "privilege escalation",
    "penetration test", "eventual", "partitioning", "normalization",
    "denormalization", "transaction isolation", "two-phase", "thread safe",
    "thread-safe", "mutex", "semaphore", "atomic", "monad", "complexity",
    "big o", "cache invalidation", "cold start", "n+1",
]
# Concept depth 1 — first-week vocabulary.
DEPTH_BASIC = [
    "variable", "loop", "for loop", "while loop", "array", "string", "function",
    "method", "class", "object", "constructor", "if statement", "boolean",
    "integer", "comment", "git", "html", "css", "div", "tag", "primary key",
    "foreign key", "http", "get request", "post request", "json", "list",
    "dictionary", "stack", "queue", "print", "syntax", "keyword", "data type",
    "operator", "return value", "null", "undefined", "try catch", "exception",
    "inheritance", "select", "insert", "update", "delete", "where clause",
    "unit test", "framework", "library", "package", "module", "component",
    "props", "state", "hook", "directive", "template", "route", "api",
]

BEGINNER_MAX_SCORE = 3.0   # form + depth <= 3.0  -> Beginner
ADVANCED_MIN_SCORE = 5.0   # form + depth >= 5.0  -> Advanced
LONG_QUESTION_CHARS = 120


def _count(hay: str, terms: list[str]) -> int:
    return sum(1 for term in terms if f" {term}" in hay)


def difficulty_score(question: str, body: str = "") -> float:
    """The raw form+depth score behind `classify_difficulty`."""
    qh = _normalise(question or "")
    bh = _normalise(body or "")

    if _count(qh, FORM_DESIGN):
        form = 3
    elif _count(qh, FORM_PRACTICAL):
        form = 2
    elif _count(qh, FORM_DEFINITION):
        form = 1
    else:
        form = 2

    advanced_in_question = _count(qh, DEPTH_ADVANCED)
    advanced_in_body = _count(bh, DEPTH_ADVANCED)
    if advanced_in_question:
        depth = 3
    elif _count(qh, DEPTH_BASIC):
        depth = 1
    else:
        depth = 2

    score = float(form + depth)
    score += 0.5 * min(advanced_in_question, 2)   # several advanced terms = deeper
    if advanced_in_body >= 3:
        score += 0.5
    if advanced_in_body >= 6:
        score += 0.5
    if len(question or "") > LONG_QUESTION_CHARS:
        score += 0.5
    return score


def classify_difficulty(question: str, body: str = "") -> str:
    """Beginner / Intermediate / Advanced — deterministic, see module notes."""
    score = difficulty_score(question, body)
    if score <= BEGINNER_MAX_SCORE:
        return "Beginner"
    if score >= ADVANCED_MIN_SCORE:
        return "Advanced"
    return "Intermediate"
