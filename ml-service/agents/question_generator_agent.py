"""
Question Generator Agent
Responsibilities:
- Generate personalized Software Engineering interview questions based on candidate profile and experience
- Provide expected knowledge points and scoring rubrics
"""

class QuestionGeneratorAgent:
    def __init__(self, model_path=None):
        self.model_path = model_path

    def generate_question(self, candidate_profile, target_topic="Backend Development", difficulty_level="Medium"):
        """
        Generates an adaptive technical interview question.
        """
        role = candidate_profile.get("role", "Software Engineer")
        exp = candidate_profile.get("experience_level", "Mid-Level")

        return {
            "question_id": f"GEN_{difficulty_level.upper()}_001",
            "interview_question": f"In a {target_topic} context for a {exp} {role}, how would you manage data consistency across distributed transactions?",
            "difficulty_level": difficulty_level,
            "topic_category": target_topic,
            "expected_knowledge_points": [
                "Saga Pattern (Choreography vs Orchestration)",
                "Two-Phase Commit (2PC) trade-offs",
                "Outbox Pattern",
                "Idempotency"
            ]
        }
