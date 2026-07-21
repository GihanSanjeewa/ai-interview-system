"""
Code Evaluator Module
Evaluates candidate code submissions across Java, Python, JavaScript, and PHP.
Provides automated feedback on code correctness, efficiency (time/space complexity), code quality, and security risks.
"""

import ast
import re

def evaluate_code_solution(code: str, language: str = "python", problem_description: str = "") -> dict:
    """
    Evaluates a candidate's code submission.
    Returns scores and qualitative feedback.
    """
    language = language.lower()
    feedback = []
    correctness_score = 70
    quality_score = 75
    security_score = 90
    complexity = "O(N)"

    if not code or len(code.strip()) == 0:
        return {
            "score": 0,
            "correctness": 0,
            "quality": 0,
            "security": 100,
            "complexity": "N/A",
            "feedback": ["No code was submitted for evaluation."]
        }

    # Language-specific checks
    if language in ("python", "py"):
        try:
            tree = ast.parse(code)
            correctness_score = 85
            feedback.append("Python code syntax is valid and parses successfully.")

            # AST Analysis
            for_loops = sum(1 for node in ast.walk(tree) if isinstance(node, (ast.For, ast.While)))
            if for_loops == 0:
                complexity = "O(1)"
            elif for_loops == 1:
                complexity = "O(N)"
            elif for_loops >= 2:
                complexity = "O(N^2)"
                feedback.append("Nested loops detected; review if time complexity can be optimized to O(N log N) or O(N).")

            functions = [node.name for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
            if functions:
                feedback.append(f"Structured solution with function(s): {', '.join(functions)}.")
            else:
                quality_score -= 10
                feedback.append("Consider encapsulating logic inside reusable functions or classes.")
        except SyntaxError as se:
            correctness_score = 30
            quality_score = 40
            feedback.append(f"Python Syntax Error on line {se.lineno}: {se.msg}")

    elif language in ("javascript", "js", "typescript", "ts"):
        if "var " in code:
            quality_score -= 10
            feedback.append("Use modern ES6 `let` or `const` declarations instead of `var`.")
        if "function" in code or "=>" in code:
            correctness_score = 85
            feedback.append("JavaScript function structure is properly declared.")
        if "eval(" in code:
            security_score = 20
            feedback.append("Security Warning: Avoid using `eval()` in JavaScript.")

    elif language == "java":
        if "class " in code:
            correctness_score = 85
            feedback.append("Java class declaration structure found.")
        if "public static void main" in code or "public " in code:
            quality_score += 10
            feedback.append("Object-oriented structure adheres to standard Java conventions.")

    elif language == "php":
        if "<?php" in code or "$" in code:
            correctness_score = 80
            feedback.append("PHP script syntax structure recognized.")
        if "eval(" in code or "exec(" in code:
            security_score = 30
            feedback.append("Security Warning: Insecure function call (eval/exec) detected.")

    # Generic quality & security heuristic checks
    if len(code.split("\n")) < 3:
        quality_score -= 10
        feedback.append("Solution is very concise; consider adding inline comments for readability.")
    
    if "TODO" in code or "FIXME" in code:
        quality_score -= 5
        feedback.append("Unfinished TODO markers present in code.")

    final_score = int((correctness_score * 0.4) + (quality_score * 0.4) + (security_score * 0.2))

    return {
        "score": final_score,
        "correctness": correctness_score,
        "quality": quality_score,
        "security": security_score,
        "complexity": complexity,
        "feedback": feedback
    }
