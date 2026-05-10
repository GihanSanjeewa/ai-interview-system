from flask import Flask, request, jsonify
import whisper

app = Flask(__name__)

model = whisper.load_model("base")

@app.route("/transcribe", methods=["POST"])
def transcribe_audio():

    audio = request.files["audio"]

    audio.save("temp.mp3")

    result = model.transcribe("temp.mp3")

    return jsonify({
        "text": result["text"]
    })

if __name__ == "__main__":
    app.run(port=8000)