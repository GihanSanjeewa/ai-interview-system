from flask import Flask, request, jsonify
import whisper

app = Flask(__name__)

model = whisper.load_model("base")

import pdfplumber
import spacy
import os

# Manually add FFmpeg path to environment
ffmpeg_path = r"C:\Users\PC\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.1-full_build\bin"
if os.path.exists(ffmpeg_path):
    os.environ["PATH"] += os.pathsep + ffmpeg_path

nlp = spacy.load("en_core_web_sm")

@app.route("/transcribe", methods=["POST"])
def transcribe_audio():
    audio = request.files["audio"]
    audio.save("temp.mp3")
    result = model.transcribe("temp.mp3")
    return jsonify({"text": result["text"]})

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Auto-select the first working model
gemini_model = None
try:
    available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
    print(f"Available models: {available_models}")
    
    # Priority list (Flash -> Flash Lite -> Pro)
    for model_name in [
        'models/gemini-2.0-flash', 
        'models/gemini-2.0-flash-lite', 
        'models/gemini-1.5-flash', 
        'models/gemini-pro'
    ]:
        if model_name in available_models:
            try:
                gemini_model = genai.GenerativeModel(model_name)
                gemini_model.generate_content("test")
                print(f"Using model: {model_name}")
                break
            except:
                continue
    
    if not gemini_model and available_models:
        gemini_model = genai.GenerativeModel(available_models[0])
        print(f"Fallback to: {available_models[0]}")
        
except Exception as e:
    print(f"Model initialization failed: {e}")

@app.route("/parse_cv", methods=["POST"])
def parse_cv():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files["file"]
    file_path = "temp_cv.pdf"
    file.save(file_path)

    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text += page.extract_text() + "\n"
    except Exception as e:
        return jsonify({"error": f"Failed to parse PDF: {str(e)}"}), 500

    # Use Gemini to extract domains
    prompt = f"""
    Analyze the following CV text and extract exactly 3-5 professional interview domains/roles 
    this person is qualified for. Return them as a simple comma-separated list.
    
    CV Text:
    {text[:2000]}
    """
    
    try:
        response = gemini_model.generate_content(prompt)
        domains = [d.strip() for d in response.text.split(",")]
    except Exception as e:
        print(f"Gemini error: {e}")
        domains = ["Software Engineering", "General Management", "Sales"] # Fallback

    return jsonify({
        "text": text,
        "domains": domains
    })

@app.route("/generate_question", methods=["POST"])
def generate_question():
    data = request.json
    cv_text = data.get("cv_text", "")
    domain = data.get("domain", "")
    history = data.get("history", []) # List of {role: "user/assistant", content: ""}
    language = data.get("language", "english").lower()

    lang_instruction = "The interview MUST be conducted in SINHALA." if language == "sinhala" else "The interview MUST be conducted in ENGLISH."

    prompt = f"""
    You are an expert interviewer for the {domain} role. 
    {lang_instruction}
    
    Based on the candidate's CV and the previous conversation history, ask the NEXT interview question.
    Keep the question professional, concise, and focused on either technical skills or behavioral traits.
    
    Candidate CV Summary: {cv_text[:1000]}
    
    History:
    {history}
    
    Ask only the question. If the language is Sinhala, ensure natural and professional phrasing.
    """
    
    try:
        response = gemini_model.generate_content(prompt)
        question = response.text.strip()
    except Exception as e:
        question = "Can you tell me about your experience in this field?" if language == "english" else "ඔබේ අත්දැකීම් ගැන මට කියන්න පුළුවන්ද?"

    return jsonify({"question": question})

@app.route("/evaluate_interview", methods=["POST"])
def evaluate_interview():
    data = request.json
    cv_text = data.get("cv_text", "")
    domain = data.get("domain", "")
    history = data.get("history", [])
    language = data.get("language", "english").lower()

    prompt = f"""
    As an expert interviewer, provide a detailed performance evaluation for the candidate.
    The interview was conducted in {language.capitalize()}.
    
    Based on the following interview history and the candidate's CV:
    
    Domain: {domain}
    Candidate CV: {cv_text[:1000]}
    
    Interview Transcript:
    {history}
    
    Provide:
    1. Overall Summary (In English)
    2. Technical Score (0-100)
    3. Communication Score (0-100)
    4. Key Strengths (In English)
    5. Areas for Improvement (In English)
    6. Mock Job Recommendations (List 3 titles in English)
    
    Format the response as a JSON object. Ensure numerical values are numbers, not strings.
    """
    
    try:
        response = gemini_model.generate_content(prompt)
        # Clean up the response to extract JSON
        res_text = response.text.strip()
        if "```json" in res_text:
            res_text = res_text.split("```json")[1].split("```")[0].strip()
        elif "```" in res_text:
            res_text = res_text.split("```")[1].split("```")[0].strip()
        
        return res_text # Assuming it returns valid JSON
    except Exception as e:
        return jsonify({
            "summary": "Interview completed.",
            "technical_score": 70,
            "communication_score": 75,
            "recommendations": ["Software Engineer", "Frontend Developer"]
        })

if __name__ == "__main__":
    app.run(port=8000)