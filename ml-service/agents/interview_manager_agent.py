"""
Interview Manager Agent
Responsibilities:
- Manage multi-turn interview lifecycle & flow control
- Dynamically adapt question queue & difficulty based on score trajectory
- Maintain state transitions and session context
"""

class InterviewManagerAgent:
    def __init__(self):
        self.current_state = "INITIALIZED"

    def process_session_step(self, session_id, candidate_profile, previous_scores):
        """
        Determines the next action in the interview session based on score trends.
        """
        if not previous_scores:
            return {
                "action": "ASK_QUESTION",
                "target_difficulty": "Medium",
                "next_topic": "Programming Fundamentals"
            }

        avg_score = sum(s.get("technical_score", 70) for s in previous_scores) / len(previous_scores)
        
        if avg_score >= 85:
            difficulty = "Hard"
        elif avg_score >= 60:
            difficulty = "Medium"
        else:
            difficulty = "Easy"

        return {
            "action": "ASK_QUESTION",
            "target_difficulty": difficulty,
            "current_score_average": round(avg_score, 2),
            "step_count": len(previous_scores) + 1
        }
