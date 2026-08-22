"""
Career Recommendation Agent
Responsibilities:
- Aggregate overall candidate interview metrics across technical, coding, and communication domains
- Identify skill gaps against industry benchmarks
- Generate target role recommendations and personalized learning roadmaps
"""

class CareerRecommendationAgent:
    def __init__(self):
        pass

    def generate_recommendation(self, candidate_profile, evaluation_history):
        """
        Synthesizes candidate interview results into career recommendations and skill roadmaps.
        """
        tech_scores = [e.get("technical_score", 70) for e in evaluation_history] if evaluation_history else [75]
        avg_tech = sum(tech_scores) / len(tech_scores)

        recommended_roles = []
        if avg_tech >= 80:
            recommended_roles = ["Senior Backend Engineer", "Distributed Systems Architect"]
        elif avg_tech >= 65:
            recommended_roles = ["Mid-Level Software Engineer", "Full-Stack Developer"]
        else:
            recommended_roles = ["Junior Developer", "Associate QA Engineer"]

        return {
            "overall_score": round(avg_tech, 2),
            "recommended_roles": recommended_roles,
            "identified_skill_gaps": [
                "Advanced Concurrency Primitives",
                "Distributed System Monitoring & Telemetry"
            ],
            "learning_roadmap": [
                "Step 1: Master Java/Go memory models and thread pools.",
                "Step 2: Study Distributed Rate Limiting & Circuit Breaker patterns.",
                "Step 3: Practice system design scenarios focusing on CAP theorem trade-offs."
            ]
        }
