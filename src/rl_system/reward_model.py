# src/rl_system/reward_model.py

from datetime import datetime

def calculate_review_reward(review_comments: str) -> float:
    """
    Calculates a reward score based on the sentiment or content of AI review comments.
    This is a simplified placeholder. A real implementation would use NLP/LLMs
    to analyze sentiment, identify specific issues, or classify feedback.

    Args:
        review_comments (str): The text of the AI reviewer's comments.

    Returns:
        float: A numerical reward score. Higher is better.
    """
    reward = 0.0
    review_comments_lower = review_comments.lower()

    if "excellent" in review_comments_lower or "perfect" in review_comments_lower or "no errors" in review_comments_lower:
        reward += 1.0
    if "good" in review_comments_lower or "well done" in review_comments_lower:
        reward += 0.5
    if "minor issues" in review_comments_lower or "small improvements" in review_comments_lower:
        reward -= 0.2
    if "major issues" in review_comments_lower or "incoherent" in review_comments_lower or "significant errors" in review_comments_lower:
        reward -= 1.0
    
    # Simple length-based penalty for very short or very long reviews (could be refined)
    if len(review_comments) < 50:
        reward -= 0.1
    elif len(review_comments) > 1000:
        reward -= 0.05 # Small penalty for overly verbose reviews

    return reward

def calculate_human_action_reward(action_type: str, feedback: str = "") -> float:
    """
    Calculates a reward score based on the human's explicit action.

    Args:
        action_type (str): The human action ('approved', 'revision_requested').
        feedback (str): The feedback provided for revision.

    Returns:
        float: A numerical reward score.
    """
    if action_type == "approved":
        return 5.0 # High positive reward for approval
    elif action_type == "revision_requested":
        # Penalize revision requests, but less if specific, actionable feedback is given
        penalty = -2.0
        if feedback and len(feedback) > 20: # More detailed feedback might imply a clearer path to improvement
            penalty += 0.5
        return penalty
    return 0.0

def log_workflow_event(event_type: str, chapter_id: str, version_id: str = None, reward: float = 0.0, details: dict = None):
    """
    Placeholder for logging workflow events and their associated rewards.
    In a real system, this would write to a persistent log (e.g., database, file, data warehouse).
    """
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "event_type": event_type,
        "chapter_id": chapter_id,
        "version_id": version_id,
        "reward": reward,
        "details": details if details else {}
    }
    print(f"RL_LOG: {log_entry}") # For now, just print to console
    # Example: Save to a JSONL file or send to a data collection service
    # with open("rl_workflow_log.jsonl", "a") as f:
    #     f.write(json.dumps(log_entry) + "\n")

# Example usage (for testing/demonstration)
if __name__ == "__main__":
    # Simulate an AI review
    review1 = "Excellent work, very coherent and engaging. No errors found."
    reward1 = calculate_review_reward(review1)
    log_workflow_event("ai_review_completed", "test_chapter_1", "v1_spun", reward1, {"review_text": review1})

    review2 = "Minor grammatical issues and some awkward phrasing. Needs polishing."
    reward2 = calculate_review_reward(review2)
    log_workflow_event("ai_review_completed", "test_chapter_1", "v2_spun", reward2, {"review_text": review2})

    # Simulate human actions
    human_approved_reward = calculate_human_action_reward("approved")
    log_workflow_event("human_action", "test_chapter_1", "v1_spun", human_approved_reward, {"action": "approved"})

    human_revision_feedback = "The narrative is too slow. Make the action scenes more dynamic and use stronger verbs."
    human_revision_reward = calculate_human_action_reward("revision_requested", human_revision_feedback)
    log_workflow_event("human_action", "test_chapter_1", "v2_spun", human_revision_reward, {"action": "revision_requested", "feedback": human_revision_feedback})
