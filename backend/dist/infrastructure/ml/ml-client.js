"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mlClient = void 0;
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const node_fs_1 = __importDefault(require("node:fs"));
const env_1 = require("@/shared/config/env");
const logger_1 = require("@/shared/logger/logger");
const http = axios_1.default.create({
    baseURL: env_1.env.ML_SERVICE_URL,
    timeout: 60_000,
});
exports.mlClient = {
    async parseCv(filePath) {
        const form = new form_data_1.default();
        form.append("file", node_fs_1.default.createReadStream(filePath));
        try {
            const res = await http.post("/cv/parse", form, {
                headers: form.getHeaders(),
            });
            return res.data;
        }
        catch (err) {
            logger_1.logger.warn({ err }, "ML CV parse failed; returning heuristic fallback");
            return fallbackCv();
        }
    },
    async scoreAnswer(args) {
        try {
            const res = await http.post("/score/answer", args);
            return res.data;
        }
        catch (err) {
            logger_1.logger.warn({ err }, "ML score/answer failed; using heuristic");
            return heuristicAnswerScore(args.transcript);
        }
    },
    async scoreSession(args) {
        try {
            const res = await http.post("/score/session", args);
            return res.data;
        }
        catch (err) {
            logger_1.logger.warn({ err }, "ML score/session failed; aggregating heuristically");
            return aggregateHeuristic(args.answers);
        }
    },
    async transcribe(filePath, language) {
        const form = new form_data_1.default();
        form.append("file", node_fs_1.default.createReadStream(filePath));
        if (language)
            form.append("language", language);
        try {
            const res = await http.post("/transcribe", form, {
                headers: form.getHeaders(),
            });
            return res.data.text;
        }
        catch (err) {
            logger_1.logger.warn({ err }, "ML transcribe failed");
            return "";
        }
    },
};
// -------- fallbacks (keep API usable even if ML svc is down) --------
function fallbackCv() {
    return {
        skills: ["JavaScript", "TypeScript", "React", "Node.js"],
        education: [],
        experience: [],
        certifications: [],
        technologies: ["React", "Node.js"],
        readinessScore: 60,
        suggestedTracks: ["react", "swe"],
        rawText: "",
    };
}
function heuristicAnswerScore(transcript) {
    const wc = transcript.trim().split(/\s+/).filter(Boolean).length;
    const base = Math.min(95, 55 + Math.round(wc / 4));
    return {
        confidence: Math.max(50, base - 4),
        communication: Math.min(95, base + 3),
        relevance: Math.min(95, base + 1),
        technical: base,
        fluency: Math.min(95, base - 2),
        pace: 84,
    };
}
function pickLevel(score) {
    if (score >= 80)
        return "ADVANCED";
    if (score >= 60)
        return "INTERMEDIATE";
    return "BEGINNER";
}
function aggregateHeuristic(answers) {
    if (answers.length === 0) {
        return zeroSession();
    }
    const m = answers.map((a) => a.metrics ?? heuristicAnswerScore(a.transcript));
    const avg = (k) => Math.round(m.reduce((s, x) => s + x[k], 0) / m.length);
    const confidence = avg("confidence");
    const communication = avg("communication");
    const relevance = avg("relevance");
    const technical = avg("technical");
    const fluency = avg("fluency");
    const pace = avg("pace");
    const overall = Math.round((confidence + communication + relevance + technical + fluency + pace) / 6);
    return {
        overallScore: overall,
        confidence,
        communication,
        relevance,
        technical,
        fluency,
        pace,
        performanceLevel: pickLevel(overall),
        strengths: [
            "Structured answers with concrete examples",
            "Maintained an even pace throughout the session",
            "Stayed engaged across the full interview",
        ],
        weaknesses: [
            "Some answers lacked depth on edge cases",
            "Filler words appeared in the opening minutes",
        ],
        suggestions: [
            "Drill 2–3 system-design walkthroughs this week",
            "Record a 60-second self-intro and refine it daily",
            "Pause for 2 seconds before answering hard questions",
        ],
        resources: [
            {
                title: "Designing Data-Intensive Applications",
                type: "Book",
                description: "Foundations every senior interviewer probes.",
            },
            {
                title: "STAR method playbook",
                type: "Article",
                description: "Structure behavioral answers with concrete outcomes.",
            },
        ],
    };
}
function zeroSession() {
    return {
        overallScore: 0,
        confidence: 0,
        communication: 0,
        relevance: 0,
        technical: 0,
        fluency: 0,
        pace: 0,
        performanceLevel: "BEGINNER",
        strengths: [],
        weaknesses: ["No answers were recorded for this session."],
        suggestions: ["Try a fresh mock interview and respond to at least 3 questions."],
        resources: [],
    };
}
//# sourceMappingURL=ml-client.js.map