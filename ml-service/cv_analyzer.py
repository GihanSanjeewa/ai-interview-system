"""
CV Analyzer - section-aware resume understanding.

Replaces the previous flat-regex approach, which produced sentence fragments as
"education", invented a degree when none was found, and estimated experience as
(max year - min year) across the whole document.

What this module does instead
-----------------------------
1. Splits the document into real resume sections by detecting headings.
2. Extracts contact identity (name, email, phone, links) from the header block.
3. Reads Experience entries as *date ranges* and computes tenure by merging
   overlapping intervals - so a 2015 degree plus a 2024 job no longer reads as
   nine years of work.
4. Extracts Education, Certifications, Projects and Skills from their own
   sections only, so a stray "university" mention in a cover letter blurb
   cannot masquerade as a qualification.
5. Reports what it could NOT find, with a confidence score, and never fabricates
   content. An empty CV yields empty lists - the interview then adapts rather
   than asking about a degree the candidate does not have.
6. Maps evidence to the six backend interview tracks (ids kept in sync with
   `interview_engine.TRACKS` / `question-bank.ts`).
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Dict, List, Optional, Set, Tuple

log = logging.getLogger("cv_analyzer")

try:
    import spacy
    _NLP = spacy.load("en_core_web_sm")
except Exception:  # pragma: no cover
    _NLP = None
    log.info("spaCy unavailable - CV name/org extraction uses pattern rules only")


# =============================================================================
# Technology & skill lexicon
# =============================================================================

# name -> detection pattern. Ordered longest-first at match time so that
# "Spring Boot" wins over "Java" inside "Java Spring Boot".
TECH_LEXICON: Dict[str, str] = {
    "Python": r"\bpython\b",
    "JavaScript": r"\b(javascript|es6\+?|ecmascript)\b",
    "TypeScript": r"\btype\s?script\b",
    "Java": r"\bjava\b(?!\s*script)",
    "C++": r"\bc\+\+\b",
    "C#": r"(\bc#|\bc\s?sharp\b|\b\.net\b)",
    "Go": r"\b(golang|go\s+lang)\b",
    "Rust": r"\brust\b",
    "PHP": r"\bphp\b",
    "Ruby": r"\bruby(\s+on\s+rails)?\b",
    "Kotlin": r"\bkotlin\b",
    "Swift": r"\bswift\b",
    "Dart / Flutter": r"\b(dart|flutter)\b",
    "R": r"(?<![a-z])r\s+(programming|language)\b",
    "React": r"\breact(\.?js)?\b",
    "React Native": r"\breact\s+native\b",
    "Angular": r"\bangular(\s?js)?\b",
    "Vue.js": r"\bvue(\.?js)?\b",
    "Next.js": r"\bnext\.?js\b",
    "Svelte": r"\bsvelte(kit)?\b",
    "Node.js": r"\bnode(\.?js)?\b",
    "Express.js": r"\bexpress(\.?js)?\b",
    "NestJS": r"\bnest\.?js\b",
    "Django": r"\bdjango\b",
    "Flask": r"\bflask\b",
    "FastAPI": r"\bfast\s?api\b",
    "Spring Boot": r"\bspring\s?(boot|framework|mvc)\b",
    "Laravel": r"\blaravel\b",
    "ASP.NET": r"\basp\.?net\b",
    "jQuery": r"\bjquery\b",
    "HTML/CSS": r"\b(html5?|css3?|scss|sass|less)\b",
    "Tailwind CSS": r"\btailwind(\s?css)?\b",
    "Bootstrap": r"\bbootstrap\b",
    "SQL": r"\bsql\b(?!\s*server\s+reporting)",
    "MySQL": r"\bmy\s?sql\b",
    "PostgreSQL": r"\b(postgre\s?sql|postgres)\b",
    "SQL Server": r"\b(ms\s?sql|sql\s+server)\b",
    "Oracle DB": r"\boracle\s*(db|database|11g|12c|19c)\b",
    "MongoDB": r"\bmongo\s?db\b|\bmongoose\b",
    "Redis": r"\bredis\b",
    "Elasticsearch": r"\belastic\s?search\b",
    "Firebase": r"\bfirebase\b",
    "GraphQL": r"\bgraph\s?ql\b",
    "REST API": r"\brest(ful)?\s*apis?\b",
    "gRPC": r"\bgrpc\b",
    "Kafka": r"\b(apache\s+)?kafka\b",
    "RabbitMQ": r"\brabbit\s?mq\b",
    "Docker": r"\bdocker\b",
    "Kubernetes": r"\b(kubernetes|k8s)\b",
    "Terraform": r"\bterraform\b",
    "Ansible": r"\bansible\b",
    "Jenkins": r"\bjenkins\b",
    "CI/CD": r"\b(ci\s?/?\s?cd|continuous\s+(integration|deployment|delivery)|"
             r"github\s+actions|gitlab\s+ci)\b",
    "AWS": r"\b(aws|amazon\s+web\s+services|ec2|s3\s+bucket|lambda)\b",
    "Azure": r"\b(microsoft\s+)?azure\b",
    "GCP": r"\b(gcp|google\s+cloud)\b",
    "Linux": r"\b(linux|ubuntu|debian|centos|unix|bash\s+script)\b",
    "Git": r"\b(git|github|gitlab|bitbucket)\b",
    "Nginx / Apache": r"\b(nginx|apache\s+(http|web|tomcat))\b",
    "Microservices": r"\bmicro\s?services?\b",
    "System Design": r"\b(system\s+design|software\s+architecture|"
                     r"distributed\s+systems?)\b",
    "TensorFlow": r"\btensor\s?flow\b",
    "PyTorch": r"\bpy\s?torch\b",
    "scikit-learn": r"\b(scikit[\s-]?learn|sklearn)\b",
    "Pandas / NumPy": r"\b(pandas|numpy)\b",
    "Machine Learning": r"\b(machine\s+learning|deep\s+learning|neural\s+network|"
                        r"\bnlp\b|computer\s+vision)\b",
    "Power BI / Tableau": r"\b(power\s?bi|tableau)\b",
    "Figma": r"\b(figma|adobe\s+xd|sketch\s+app)\b",
    "Selenium": r"\bselenium\b",
    "Jest / Pytest": r"\b(jest|pytest|junit|mocha|jasmine|cypress|playwright)\b",
    "Cybersecurity": r"\b(penetration\s+testing|pen\s?test|owasp|"
                     r"vulnerability\s+assessment|ethical\s+hacking)\b",
    "Networking": r"\b(tcp/ip|subnetting|ccna|routing\s+and\s+switching|"
                  r"firewall|vlan)\b",
}

CONCEPT_LEXICON: Dict[str, str] = {
    "Object-Oriented Programming (OOP)": r"\b(oop|object[\s-]?oriented)\b",
    "SOLID Principles": r"\bsolid\s+(principles?|design)\b",
    "Design Patterns": r"\bdesign\s+patterns?\b",
    "Data Structures & Algorithms": r"\b(data\s+structures?|algorithms?|"
                                    r"\bdsa\b|competitive\s+programming)\b",
    "Test-Driven Development (TDD)": r"\b(tdd|test[\s-]driven|unit\s+test)\b",
    "Agile / Scrum": r"\b(agile|scrum|kanban|sprint\s+planning)\b",
    "Clean Code": r"\bclean\s+code\b",
    "API Design": r"\bapi\s+design\b",
    "Performance Optimization": r"\b(performance\s+(tuning|optimi[sz]ation)|"
                                r"query\s+optimi[sz]ation|latency\s+reduction)\b",
    "Requirements Engineering": r"\b(requirement[s]?\s+(gathering|analysis|"
                                r"elicitation)|user\s+stor(y|ies)|use\s+case)\b",
    "UI/UX Design": r"\b(ui/ux|user\s+experience|wireframe|prototyp|usability)\b",
    "Technical Leadership": r"\b(mentor(ed|ing)?|led\s+a\s+team|team\s+lead|"
                            r"code\s+review)\b",
    "Problem Solving": r"\bproblem[\s-]solving\b",
    "Version Control": r"\b(version\s+control|branching\s+strategy|git\s?flow)\b",
}


# =============================================================================
# Section segmentation
# =============================================================================

# Canonical section -> heading aliases seen on real CVs.
SECTION_ALIASES: Dict[str, List[str]] = {
    "summary": ["summary", "profile", "professional summary", "career objective",
                "objective", "about me", "personal statement", "profile summary"],
    "experience": ["experience", "work experience", "professional experience",
                   "employment", "employment history", "work history",
                   "career history", "professional background", "internship",
                   "internships", "work"],
    "education": ["education", "academic background", "academic qualifications",
                  "qualifications", "educational background", "academics",
                  "education and training"],
    "skills": ["skills", "technical skills", "core competencies", "competencies",
               "technologies", "tech stack", "skills and technologies",
               "technical proficiency", "areas of expertise", "expertise",
               "tools and technologies"],
    "projects": ["projects", "personal projects", "academic projects",
                 "key projects", "selected projects", "portfolio",
                 "project experience"],
    "certifications": ["certifications", "certificates", "licenses",
                       "certifications and licenses", "courses",
                       "professional development", "training"],
    "awards": ["awards", "achievements", "honors", "honours",
               "awards and achievements"],
    "languages": ["languages", "language proficiency"],
    "references": ["references", "referees"],
    "interests": ["interests", "hobbies", "activities", "extracurricular"],
    "publications": ["publications", "research", "papers"],
}

# Reverse index for fast heading lookup.
_HEADING_INDEX: Dict[str, str] = {
    alias: canon
    for canon, aliases in SECTION_ALIASES.items()
    for alias in aliases
}


def _normalise_heading(line: str) -> Optional[str]:
    """Return the canonical section name if `line` is a section heading."""
    raw = line.strip()
    if not raw or len(raw) > 60:
        return None
    # Strip decoration: bullets, colons, underscores, pipes, leading numbers.
    cleaned = re.sub(r"^[\s\-–—*•#>\d.)|]+", "", raw)
    cleaned = re.sub(r"[:\-–—_|=~*\s]+$", "", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip().lower()
    if not cleaned or len(cleaned.split()) > 4:
        return None
    if cleaned in _HEADING_INDEX:
        return _HEADING_INDEX[cleaned]
    # Allow "Technical Skills & Tools" style headings.
    core = re.split(r"\s*(?:&|and|/)\s*", cleaned)[0].strip()
    return _HEADING_INDEX.get(core)


@dataclass
class CvSections:
    header: List[str] = field(default_factory=list)
    sections: Dict[str, List[str]] = field(default_factory=dict)

    def get(self, name: str) -> List[str]:
        return self.sections.get(name, [])

    def text(self, name: str) -> str:
        return "\n".join(self.get(name))

    @property
    def found(self) -> List[str]:
        return sorted(self.sections.keys())


def segment(raw_text: str) -> CvSections:
    """Split the CV into a header block plus canonical sections."""
    out = CvSections()
    lines = [ln.rstrip() for ln in (raw_text or "").splitlines()]
    current: Optional[str] = None
    for ln in lines:
        heading = _normalise_heading(ln)
        if heading:
            current = heading
            out.sections.setdefault(current, [])
            continue
        if not ln.strip():
            continue
        if current is None:
            out.header.append(ln.strip())
        else:
            out.sections[current].append(ln.strip())
    return out


# =============================================================================
# Contact identity
# =============================================================================

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
# Sri Lankan (+94 / 0xx) plus generic international formats.
PHONE_RE = re.compile(
    r"(?:(?:\+|00)\d{1,3}[\s.-]?)?(?:\(?0?\d{2,4}\)?[\s.-]?)\d{3}[\s.-]?\d{3,4}\b")
LINK_RE = re.compile(
    r"\b((?:https?://)?(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|"
    r"medium\.com|behance\.net|dribbble\.com|stackoverflow\.com)/[\w./%-]+)",
    re.IGNORECASE)

_NON_NAME_TOKENS = re.compile(
    r"\b(curriculum\s+vitae|resume|cv|profile|address|phone|mobile|email|"
    r"tel|contact|linkedin|github|nationality|date\s+of\s+birth|dob|"
    r"gender|marital|www|http)\b", re.IGNORECASE)


def extract_contact(sections: CvSections, raw_text: str) -> Dict[str, Any]:
    header_text = "\n".join(sections.header[:12])
    emails = EMAIL_RE.findall(raw_text)
    links = [m if m.startswith("http") else "https://" + m
             for m in LINK_RE.findall(raw_text)]

    phones: List[str] = []
    for cand in PHONE_RE.findall(raw_text):
        digits = re.sub(r"\D", "", cand)
        # Reject year ranges and other numeric noise masquerading as a number.
        if 9 <= len(digits) <= 15:
            phones.append(cand.strip())

    return {
        "name": _extract_name(sections, header_text, emails),
        "email": emails[0] if emails else None,
        "phone": phones[0] if phones else None,
        "links": sorted(set(links))[:5],
    }


def _extract_name(sections: CvSections, header_text: str,
                  emails: List[str]) -> Optional[str]:
    """The candidate's name, from the header block only."""
    # 1. spaCy PERSON entity in the header - most reliable when available.
    if _NLP is not None and header_text.strip():
        try:
            doc = _NLP(header_text[:400])
            for ent in doc.ents:
                if ent.label_ == "PERSON" and 2 <= len(ent.text.split()) <= 4:
                    return ent.text.strip()
        except Exception:  # pragma: no cover
            pass

    # 2. First header line that looks like a human name.
    for line in sections.header[:6]:
        cand = line.strip(" .,|-")
        if _NON_NAME_TOKENS.search(cand) or EMAIL_RE.search(cand):
            continue
        words = cand.split()
        if not (2 <= len(words) <= 4):
            continue
        if any(ch.isdigit() for ch in cand):
            continue
        # Title Case or ALL CAPS, letters only.
        if all(re.fullmatch(r"[A-Z][a-z'\-]+|[A-Z.'\-]{2,}", w) for w in words):
            return " ".join(w.capitalize() if w.isupper() and len(w) > 2 else w
                            for w in words)

    # 3. Derive from the email local part as a last resort ("nimal.perera@").
    if emails:
        local = emails[0].split("@")[0]
        parts = [p for p in re.split(r"[._\-0-9]+", local) if len(p) > 1]
        if len(parts) >= 2:
            return " ".join(p.capitalize() for p in parts[:3])
    return None


# =============================================================================
# Experience: real date-range tenure
# =============================================================================

MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
    "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
    "aug": 8, "august": 8, "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10, "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

_PRESENT = r"(present|current|now|to\s?date|ongoing)"

# "Jan 2021 - Mar 2023", "01/2021 to Present", "2021 - 2023"
RANGE_RE = re.compile(
    r"(?P<start>"
    r"(?:(?P<smon>[A-Za-z]{3,9})[\s.,]+)?(?P<syear>(?:19|20)\d{2})"
    r"|(?P<smon2>0?[1-9]|1[0-2])[/-](?P<syear2>(?:19|20)\d{2})"
    r")"
    r"\s*(?:-|–|—|to|until|till|→)\s*"
    r"(?P<end>"
    r"(?:(?P<emon>[A-Za-z]{3,9})[\s.,]+)?(?P<eyear>(?:19|20)\d{2})"
    r"|(?P<emon2>0?[1-9]|1[0-2])[/-](?P<eyear2>(?:19|20)\d{2})"
    r"|(?P<present>" + _PRESENT + r")"
    r")",
    re.IGNORECASE,
)

JOB_TITLE_RE = re.compile(
    r"\b((?:senior|junior|lead|principal|staff|associate|assistant|chief|head\s+of|"
    r"trainee|intern|graduate)?\s*"
    r"(?:software|full[\s-]?stack|front[\s-]?end|back[\s-]?end|web|mobile|"
    r"devops|site\s+reliability|cloud|data|machine\s+learning|ml|ai|qa|test|"
    r"security|network|systems?|database|business|ui/ux|ux|ui|product|project)?"
    r"\s*(?:engineer|developer|programmer|analyst|architect|administrator|"
    r"designer|scientist|consultant|manager|lead|specialist|intern|trainee))\b",
    re.IGNORECASE,
)


def _to_month_index(year: int, month: Optional[int]) -> int:
    """Absolute month index so intervals can be compared and merged."""
    return year * 12 + (month or 1) - 1


def _parse_ranges(text: str) -> List[Tuple[int, int]]:
    """All date ranges in `text` as (start_month_index, end_month_index)."""
    today = date.today()
    now_idx = _to_month_index(today.year, today.month)
    out: List[Tuple[int, int]] = []

    for m in RANGE_RE.finditer(text):
        syear = m.group("syear") or m.group("syear2")
        if not syear:
            continue
        smon_name = m.group("smon")
        smon = (MONTHS.get(smon_name.lower()[:4].rstrip("."))
                or MONTHS.get(smon_name.lower()[:3]) if smon_name else None)
        if smon is None and m.group("smon2"):
            smon = int(m.group("smon2"))
        start = _to_month_index(int(syear), smon)

        if m.group("present"):
            end = now_idx
        else:
            eyear = m.group("eyear") or m.group("eyear2")
            if not eyear:
                continue
            emon_name = m.group("emon")
            emon = (MONTHS.get(emon_name.lower()[:4].rstrip("."))
                    or MONTHS.get(emon_name.lower()[:3]) if emon_name else None)
            if emon is None and m.group("emon2"):
                emon = int(m.group("emon2"))
            # A bare end year means "through the end of that year".
            end = _to_month_index(int(eyear), emon if emon else 12)

        if end < start:
            start, end = end, start
        # Reject implausible ranges (typos, birth dates, future starts).
        if start > now_idx or (end - start) > 12 * 45:
            continue
        out.append((start, min(end, now_idx)))
    return out


def _merge_months(ranges: List[Tuple[int, int]]) -> int:
    """Total months covered, merging overlaps so parallel roles count once."""
    if not ranges:
        return 0
    ordered = sorted(ranges)
    total = 0
    cur_start, cur_end = ordered[0]
    for start, end in ordered[1:]:
        if start <= cur_end + 1:            # overlapping or adjacent
            cur_end = max(cur_end, end)
        else:
            total += cur_end - cur_start + 1
            cur_start, cur_end = start, end
    total += cur_end - cur_start + 1
    return total


def extract_experience(sections: CvSections) -> Dict[str, Any]:
    """
    Experience entries and tenure, computed from the Experience section only.

    Returns yearsTotal=None when the CV states no dates - the caller must not
    substitute a guess.
    """
    lines = sections.get("experience")
    block = "\n".join(lines)
    entries: List[Dict[str, Any]] = []

    for ln in lines:
        if len(ln) < 6:
            continue
        title_m = JOB_TITLE_RE.search(ln)
        ranges = _parse_ranges(ln)
        if not (title_m or ranges):
            continue

        # CVs commonly put the dates on their own line under the job title.
        # That line belongs to the role above it, not to a new role.
        if not title_m and ranges and entries:
            if entries[-1]["months"] is None:
                entries[-1]["months"] = _merge_months(ranges)
                entries[-1]["current"] = bool(
                    re.search(_PRESENT, ln, re.IGNORECASE))
            continue
        if not title_m and ranges:
            continue                     # a stray date line with no role above

        title = title_m.group(0).strip()
        org = _extract_org(ln, title)
        label = "%s at %s" % (title.title(), org) if org else title.title()
        entries.append({
            "label": re.sub(r"\s{2,}", " ", label).strip(" .,-"),
            "title": title.title(),
            "organisation": org,
            "months": _merge_months(ranges) if ranges else None,
            "current": bool(re.search(_PRESENT, ln, re.IGNORECASE)),
        })

    # Tenure across the whole section, so a range on its own line still counts.
    all_ranges = _parse_ranges(block)
    total_months = _merge_months(all_ranges)

    # Explicit self-declared experience ("4+ years of experience") is a strong
    # signal and wins when it exceeds what the date ranges show.
    declared = None
    for m in re.finditer(r"(\d{1,2})\s*\+?\s*(?:years?|yrs?)"
                         r"(?:\s+of)?\s+(?:professional\s+|industry\s+)?"
                         r"experience", "\n".join(sections.header) + "\n" +
                         sections.text("summary") + "\n" + block,
                         re.IGNORECASE):
        val = int(m.group(1))
        if 0 < val <= 45:
            declared = max(declared or 0, val)

    years: Optional[float] = None
    if total_months:
        years = round(total_months / 12.0, 1)
    if declared is not None:
        years = float(declared) if years is None else max(years, float(declared))

    # De-duplicate entries while preserving order.
    seen: Set[str] = set()
    unique: List[Dict[str, Any]] = []
    for e in entries:
        key = e["label"].lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(e)

    return {
        "entries": unique[:6],
        "yearsTotal": years,
        "monthsTotal": total_months or None,
        "declaredYears": declared,
        "datedRanges": len(all_ranges),
    }


_ORG_STOP = re.compile(
    r"^(the|a|an|and|at|for|in|of|with|using|to)$", re.IGNORECASE)


def _extract_org(line: str, title: Optional[str]) -> Optional[str]:
    """Employer name from an experience line."""
    # "Software Engineer at Ceylon Systems (Pvt) Ltd"
    m = re.search(r"\bat\s+([A-Z][\w&.'-]*(?:\s+[A-Z(][\w&.'()-]*){0,4})", line)
    if m:
        return _clean_org(m.group(1))
    # "Software Engineer | Ceylon Systems | 2021-2023"
    if title:
        parts = [p.strip() for p in re.split(r"[|•–—,;]", line)]
        for p in parts:
            if not p or p.lower() == title.lower():
                continue
            if re.search(r"(19|20)\d{2}", p) or JOB_TITLE_RE.fullmatch(p or ""):
                continue
            if re.match(r"^[A-Z]", p) and 2 <= len(p.split()) <= 6:
                return _clean_org(p)
    # spaCy ORG as a fallback.
    if _NLP is not None:
        try:
            for ent in _NLP(line[:200]).ents:
                if ent.label_ == "ORG":
                    return _clean_org(ent.text)
        except Exception:  # pragma: no cover
            pass
    return None


def _clean_org(text: str) -> Optional[str]:
    org = re.sub(r"\s{2,}", " ", text).strip(" .,;:|-")
    org = re.sub(r"\s*\((19|20)\d{2}.*$", "", org)
    words = [w for w in org.split() if not _ORG_STOP.fullmatch(w)]
    org = " ".join(words)
    if not (2 <= len(org) <= 60) or not re.search(r"[A-Za-z]{2}", org):
        return None
    return org


# =============================================================================
# Education & certifications
# =============================================================================

DEGREE_RE = re.compile(
    r"\b(ph\.?d|doctorate|"
    r"m\.?sc|m\.?s\.?c|master(?:'?s)?(?:\s+of\s+\w+)?|m\.?eng|m\.?b\.?a|m\.?tech|"
    r"b\.?sc|b\.?s\.?c|bachelor(?:'?s)?(?:\s+of\s+\w+)?|b\.?eng|b\.?tech|b\.?it|"
    r"hnd|higher\s+national\s+diploma|advanced\s+diploma|diploma|"
    r"associate\s+degree|foundation|a\s*/?\s*l|g\.?c\.?e)\b",
    re.IGNORECASE)

_INSTITUTION_KEYWORD = re.compile(
    r"\b(university|institute|college|academy|campus|polytechnic|"
    r"school\s+of)\b", re.IGNORECASE)


def _find_institution(line: str) -> Optional[str]:
    """
    Institution name from a single CV line.

    Takes the whole line minus trailing dates/grades, because on a real CV the
    institution occupies its own line ("University of Colombo School of
    Computing, 2018 - 2022"). Matching a capitalised phrase around the keyword
    is fragile - `[A-Z]` under IGNORECASE happily matches lowercase words and
    swallows the preceding degree text.
    """
    if not _INSTITUTION_KEYWORD.search(line):
        return None
    # Drop trailing date ranges, single years, GPA and grade annotations.
    cleaned = re.sub(
        r"[,;|(\[]?\s*(?:(?:19|20)\d{2}\s*(?:-|–|—|to)?\s*"
        r"(?:(?:19|20)\d{2}|present|current)?|gpa[\s:]*[\d.]+|"
        r"cgpa[\s:]*[\d.]+|first\s+class.*|second\s+class.*)\s*[)\]]?\s*$",
        "", line, flags=re.IGNORECASE).strip(" .,;:|-")
    # Keep only from the institution keyword's phrase onward when a degree
    # shares the line ("B.Sc. in IT, University of Moratuwa").
    parts = [p.strip() for p in re.split(r"\s*[,|]\s*", cleaned) if p.strip()]
    for p in parts:
        if _INSTITUTION_KEYWORD.search(p):
            cleaned = p
            break
    return _clean_institution(cleaned)

# Field of study, e.g. "B.Sc. (Hons) in Software Engineering".
# Stops at institution keywords so the field never swallows the university name.
FIELD_RE = re.compile(
    r"\bin\s+((?!university|institute|college|academy|campus|school)"
    r"[A-Z][\w&'-]*"
    r"(?:\s+(?:and|&|of)\s+|\s+)"
    r"(?!university|institute|college|academy|campus|school)"
    r"[A-Z][\w&'-]*){0,1}",
    re.IGNORECASE)

# Cleaner: capture the field as everything after "in" up to a comma/paren/EOL.
FIELD_SPAN_RE = re.compile(
    r"\bin\s+([^,;|()\n]{3,45}?)"
    r"(?=\s*(?:,|;|\||\(|$|\bat\b|\bfrom\b|\buniversity\b|\binstitute\b|"
    r"\bcollege\b|\bacademy\b|\bcampus\b|\bschool\b))",
    re.IGNORECASE)


def extract_education(sections: CvSections) -> List[Dict[str, Any]]:
    """Education entries from the Education section only. May be empty."""
    lines = sections.get("education")
    out: List[Dict[str, Any]] = []
    seen: Set[str] = set()

    # A CV often puts the degree and the institution on adjacent lines. When a
    # degree line consumes the next line as its institution, that line must not
    # then be emitted as a qualification of its own.
    consumed: Set[int] = set()

    for i, ln in enumerate(lines):
        if len(ln) < 5 or i in consumed:
            continue
        window = " ".join(lines[i:i + 2])
        degree_m = DEGREE_RE.search(ln)
        # Look for the institution on this line first, then the next one.
        institution = _find_institution(ln)
        if institution is None and i + 1 < len(lines):
            institution = _find_institution(lines[i + 1])
            if institution is not None and degree_m:
                consumed.add(i + 1)
        if not (degree_m or institution):
            continue

        degree = degree_m.group(0).strip() if degree_m else None
        field_m = FIELD_SPAN_RE.search(ln)
        field = field_m.group(1).strip(" .,-") if field_m else None
        years = sorted(int(y) for y in re.findall(r"\b(?:19|20)\d{2}\b", window))

        label_parts = []
        if degree:
            label_parts.append(_pretty_degree(degree))
        if field:
            label_parts.append("in " + field)
        label = " ".join(label_parts) if label_parts else (institution or ln[:70])
        if institution and label_parts:
            label = "%s, %s" % (label, institution)

        key = re.sub(r"\W+", "", label.lower())
        if key in seen:
            continue
        # An institution-only line that belongs to the degree above it is not a
        # separate qualification - fold it in rather than listing it twice.
        if not degree and institution and out and not out[-1]["institution"]:
            out[-1]["institution"] = institution
            out[-1]["label"] = "%s, %s" % (out[-1]["label"], institution)
            if years:
                out[-1]["graduationYear"] = years[-1]
            continue
        seen.add(key)
        out.append({
            "label": re.sub(r"\s{2,}", " ", label).strip(" .,-"),
            "degree": _pretty_degree(degree) if degree else None,
            "field": field,
            "institution": institution,
            "graduationYear": years[-1] if years else None,
        })
    return out[:4]


def _pretty_degree(degree: str) -> str:
    canon = degree.lower().replace(".", "").replace(" ", "")
    table = {
        "bsc": "B.Sc.", "bs": "B.Sc.", "beng": "B.Eng.", "btech": "B.Tech.",
        "bit": "B.IT", "msc": "M.Sc.", "ms": "M.Sc.", "meng": "M.Eng.",
        "mtech": "M.Tech.", "mba": "MBA", "phd": "Ph.D.",
        "hnd": "HND", "highernationaldiploma": "HND",
    }
    if canon in table:
        return table[canon]
    return degree.strip().title()


def _clean_institution(text: str) -> Optional[str]:
    inst = re.sub(r"\s{2,}", " ", text).strip(" .,;:|-")
    inst = re.sub(r"^(at|from|the)\s+", "", inst, flags=re.IGNORECASE)
    inst = re.sub(r"\s*[\(\[].*$", "", inst)
    if not (4 <= len(inst) <= 70):
        return None
    return inst.title() if inst.isupper() else inst


CERT_RE = re.compile(
    r"\b((?:aws|azure|gcp|google|microsoft|oracle|cisco|comptia|scrum|pmi|"
    r"kubernetes|red\s?hat|salesforce|ibm|isc2)\s*"
    r"[\w\s+#/.-]{0,45}?"
    r"(?:certified|certificate|certification|professional|associate|"
    r"practitioner|ccna|ccnp|ccie|security\+|network\+|a\+|cissp|ceh|"
    r"psm|pmp|cka|ckad|rhcsa|rhce)"
    r"[\w\s+#/.-]{0,25})",
    re.IGNORECASE)


def extract_certifications(sections: CvSections) -> List[str]:
    """Certifications from their own section, plus clearly-named ones elsewhere."""
    out: List[str] = []
    seen: Set[str] = set()
    scope = sections.get("certifications") or []
    # Certifications are frequently listed under Education too.
    scope = scope + sections.get("education") + sections.get("awards")

    for ln in scope:
        for m in CERT_RE.finditer(ln):
            val = re.sub(r"\s{2,}", " ", m.group(1)).strip(" .,;:|-")
            if not (6 <= len(val) <= 80):
                continue
            key = re.sub(r"\W+", "", val.lower())
            if key in seen:
                continue
            seen.add(key)
            out.append(val)
        # A dedicated Certifications section: take clean bullet lines as-is.
        if ln in sections.get("certifications") and not CERT_RE.search(ln):
            clean = ln.strip(" .,;:|-•*")
            if 8 <= len(clean) <= 80 and not re.match(r"^(19|20)\d{2}", clean):
                key = re.sub(r"\W+", "", clean.lower())
                if key not in seen:
                    seen.add(key)
                    out.append(clean)
    return out[:6]


def extract_projects(sections: CvSections) -> List[str]:
    """Project names from the Projects section."""
    out: List[str] = []
    seen: Set[str] = set()
    for ln in sections.get("projects"):
        clean = ln.strip(" .,;:|-•*–")
        if not (6 <= len(clean) <= 90):
            continue
        # A project heading is a name, not a sentence of responsibilities.
        if clean.lower().startswith(("developed", "implemented", "responsible",
                                     "worked", "used", "built using",
                                     "technologies", "tech stack", "tools")):
            continue
        # Trim a trailing tech list: "Chat App - React, Node.js, Socket.io"
        name = re.split(r"\s*[–—|:]\s*|\s+-\s+", clean)[0].strip()
        if not (4 <= len(name) <= 70):
            name = clean[:70]
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(name)
    return out[:5]


# =============================================================================
# Skills & technologies
# =============================================================================

def extract_skills(sections: CvSections, raw_text: str) -> Dict[str, List[str]]:
    """
    Detect technologies and concepts.

    Weighted by *where* the mention appears: the Skills section is the strongest
    evidence, Experience/Projects next, and anywhere else weakest. This lets the
    report distinguish claimed skills from demonstrated ones.
    """
    zones = {
        "skills": sections.text("skills"),
        "experience": sections.text("experience"),
        "projects": sections.text("projects"),
        "summary": sections.text("summary"),
        "other": raw_text,
    }
    zones_lower = {k: v.lower() for k, v in zones.items()}

    technologies: List[str] = []
    evidence: Dict[str, List[str]] = {}
    for name, pattern in TECH_LEXICON.items():
        hits = [z for z, text in zones_lower.items()
                if text and re.search(pattern, text, re.IGNORECASE)]
        if hits:
            technologies.append(name)
            evidence[name] = [h for h in hits if h != "other"] or ["other"]

    concepts: List[str] = []
    for name, pattern in CONCEPT_LEXICON.items():
        if re.search(pattern, zones_lower["other"], re.IGNORECASE):
            concepts.append(name)

    # Technologies backed by Experience or Projects are demonstrated, not just
    # listed. This drives both the report and question difficulty.
    demonstrated = [t for t, zs in evidence.items()
                    if {"experience", "projects"} & set(zs)]

    return {
        "technologies": technologies,
        "skills": concepts,
        "demonstrated": demonstrated,
        "evidence": evidence,
    }


# =============================================================================
# Track mapping & readiness
# =============================================================================

# Track id -> technologies/concepts that count as evidence for it.
# Ids MUST match interview_engine.TRACKS and backend question-bank.ts.
TRACK_SIGNALS: Dict[str, List[str]] = {
    "software_engineering": [
        "Java", "C++", "C#", "Python", "Go", "Rust", "Kotlin", "Swift",
        "Object-Oriented Programming (OOP)", "SOLID Principles",
        "Design Patterns", "Data Structures & Algorithms",
        "Test-Driven Development (TDD)", "Clean Code", "Git",
        "Jest / Pytest", "Version Control", "System Design",
    ],
    "web_development": [
        "React", "Angular", "Vue.js", "Next.js", "Svelte", "Node.js",
        "Express.js", "NestJS", "Django", "Flask", "FastAPI", "Laravel",
        "ASP.NET", "Spring Boot", "jQuery", "HTML/CSS", "Tailwind CSS",
        "Bootstrap", "TypeScript", "JavaScript", "REST API", "GraphQL",
        "API Design", "React Native",
    ],
    "data_science": [
        "Machine Learning", "TensorFlow", "PyTorch", "scikit-learn",
        "Pandas / NumPy", "Python", "SQL", "R", "Power BI / Tableau",
        "PostgreSQL", "MySQL", "Elasticsearch",
    ],
    "networking": [
        "Networking", "Linux", "Docker", "Kubernetes", "Terraform", "Ansible",
        "Jenkins", "CI/CD", "AWS", "Azure", "GCP", "Nginx / Apache",
        "Cybersecurity", "Microservices",
    ],
    "ui_ux": [
        "Figma", "UI/UX Design", "HTML/CSS", "Tailwind CSS", "Bootstrap",
        "React", "Vue.js",
    ],
    "business_analysis": [
        "Requirements Engineering", "Agile / Scrum", "Power BI / Tableau",
        "SQL", "API Design", "Technical Leadership",
    ],
}

TRACK_LABELS = {
    "software_engineering": "Software Engineering",
    "web_development": "Web Development",
    "data_science": "Data Science",
    "networking": "Networking",
    "ui_ux": "UI/UX",
    "business_analysis": "Business Analysis",
}


def suggest_tracks(skills: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    """Rank the six interview tracks by how much CV evidence supports each."""
    have = set(skills["technologies"]) | set(skills["skills"])
    demonstrated = set(skills["demonstrated"])
    ranked: List[Dict[str, Any]] = []

    for tid, signals in TRACK_SIGNALS.items():
        matched = [s for s in signals if s in have]
        if not matched:
            continue
        # Demonstrated evidence counts double against listed-only evidence.
        weight = sum(2 if s in demonstrated else 1 for s in matched)
        coverage = weight / (len(signals) * 2)
        ranked.append({
            "track": tid,
            "label": TRACK_LABELS[tid],
            "matched": matched[:8],
            "matchCount": len(matched),
            "confidence": round(min(1.0, coverage * 2.4), 2),
        })

    ranked.sort(key=lambda r: (-r["matchCount"], -r["confidence"]))
    return ranked[:4]


def compute_readiness(
    skills: Dict[str, List[str]],
    education: List[Dict[str, Any]],
    experience: Dict[str, Any],
    certifications: List[str],
    projects: List[str],
    raw_text: str,
) -> Dict[str, Any]:
    """
    Readiness score with a transparent, auditable breakdown.

    Every component is capped and derived from evidence actually found, so the
    report can explain the number instead of asserting it.
    """
    techs = skills["technologies"]
    demonstrated = skills["demonstrated"]
    years = experience.get("yearsTotal")

    breadth = min(len(techs) * 2.2, 22.0)
    depth = min(len(demonstrated) * 3.0, 18.0)
    concepts = min(len(skills["skills"]) * 2.2, 14.0)
    tenure = min((years or 0) * 4.0, 20.0)
    edu = 0.0
    if education:
        best = max((e.get("degree") or "" for e in education), key=len, default="")
        edu = 10.0 if re.search(r"(Ph\.D|M\.)", best) else 8.0 if best else 5.0
    certs = min(len(certifications) * 3.0, 8.0)
    proj = min(len(projects) * 2.0, 8.0)
    # A one-page CV with no detail cannot support a high score.
    detail = 4.0 if len(raw_text) > 1800 else 2.0 if len(raw_text) > 600 else 0.0

    components = {
        "technologyBreadth": round(breadth, 1),
        "demonstratedDepth": round(depth, 1),
        "engineeringConcepts": round(concepts, 1),
        "experienceTenure": round(tenure, 1),
        "education": round(edu, 1),
        "certifications": round(certs, 1),
        "projects": round(proj, 1),
        "cvDetail": round(detail, 1),
    }
    total = sum(components.values())
    return {
        "readinessScore": int(round(min(total, 100.0))),
        "breakdown": components,
        "maxima": {
            "technologyBreadth": 22, "demonstratedDepth": 18,
            "engineeringConcepts": 14, "experienceTenure": 20,
            "education": 10, "certifications": 8, "projects": 8, "cvDetail": 4,
        },
    }


# =============================================================================
# Public entry point
# =============================================================================

def analyze_cv(raw_text: str) -> Dict[str, Any]:
    """
    Full CV analysis.

    Never fabricates: a field the CV does not contain comes back empty or None,
    and `warnings` explains what was missing so the UI can prompt the user.
    """
    text = raw_text or ""
    sections = segment(text)

    # A CV exported from some PDF tools has no blank lines or headings; fall
    # back to treating the whole document as every section so detection still
    # works, at the cost of zone-weighted evidence.
    if not sections.sections:
        flat = [ln.strip() for ln in text.splitlines() if ln.strip()]
        sections.sections = {"experience": flat, "education": flat,
                             "skills": flat, "projects": []}
        degraded = True
    else:
        degraded = False

    contact = extract_contact(sections, text)
    skills = extract_skills(sections, text)
    education = extract_education(sections)
    experience = extract_experience(sections)
    certifications = extract_certifications(sections)
    projects = extract_projects(sections)
    tracks = suggest_tracks(skills)
    readiness = compute_readiness(skills, education, experience,
                                 certifications, projects, text)

    warnings: List[str] = []
    if not text.strip():
        warnings.append("No text could be extracted from the file. If it is a "
                        "scanned PDF, upload a text-based version.")
    if degraded:
        warnings.append("No section headings were detected, so skills could not "
                        "be attributed to specific sections. Adding headings "
                        "like 'Experience' and 'Education' improves accuracy.")
    if not skills["technologies"]:
        warnings.append("No technologies were detected. Add a Technical Skills "
                        "section listing the tools you use.")
    if not education:
        warnings.append("No education entries were detected under an Education "
                        "heading.")
    if not experience["entries"]:
        warnings.append("No work experience entries were detected under an "
                        "Experience heading.")
    if experience["yearsTotal"] is None:
        warnings.append("No dated roles were found, so total years of "
                        "experience could not be calculated. Add date ranges "
                        "like 'Jan 2022 - Present'.")
    if not projects:
        warnings.append("No projects were detected. A Projects section gives "
                        "the interviewer concrete work to ask about.")

    # Extraction confidence: how much of the expected structure we recovered.
    signals = [
        bool(contact["name"]), bool(contact["email"]),
        bool(skills["technologies"]), bool(education),
        bool(experience["entries"]), experience["yearsTotal"] is not None,
        bool(projects), len(sections.found) >= 3,
    ]
    confidence = round(sum(signals) / len(signals), 2)

    return {
        # --- identity ---
        "contact": contact,
        # --- structured content (empty when absent - never invented) ---
        "technologies": skills["technologies"],
        "skills": skills["skills"],
        "demonstratedTechnologies": skills["demonstrated"],
        "skillEvidence": skills["evidence"],
        "education": [e["label"] for e in education],
        "educationDetail": education,
        "experience": [e["label"] for e in experience["entries"]],
        "experienceDetail": experience["entries"],
        "certifications": certifications,
        "projects": projects,
        # --- derived ---
        "yearsTotal": experience["yearsTotal"],
        "monthsTotal": experience["monthsTotal"],
        "declaredYears": experience["declaredYears"],
        "seniority": _seniority(experience["yearsTotal"]),
        "readinessScore": readiness["readinessScore"],
        "readinessBreakdown": readiness["breakdown"],
        "readinessMaxima": readiness["maxima"],
        "suggestedTracks": [t["track"] for t in tracks],
        "trackAnalysis": tracks,
        # --- diagnostics ---
        "sectionsFound": sections.found,
        "extractionConfidence": confidence,
        "warnings": warnings,
        "rawText": text,
    }


def _seniority(years: Optional[float]) -> str:
    if years is None:
        return "unknown"
    if years < 1:
        return "entry"
    if years < 3:
        return "junior"
    if years < 6:
        return "mid"
    if years < 10:
        return "senior"
    return "principal"
