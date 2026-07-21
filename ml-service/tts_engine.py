"""
Local Text-to-Speech (TTS) Engine
Generates spoken audio for AI interviewer questions and voice responses.
"""

import os
import wave
import struct

def generate_speech_audio(text: str, output_path: str = "ai_response.wav", language: str = "en") -> str:
    """
    Generates an audio file from text using local TTS options.
    Returns path to the generated audio file.
    """
    try:
        import pyttsx3
        engine = pyttsx3.init()
        engine.setProperty('rate', 150)  # Speaking speed WPM
        engine.save_to_file(text, output_path)
        engine.runAndWait()
        return output_path
    except Exception as e:
        print(f"pyttsx3 TTS fallback ({e}), generating silence/tone WAV fallback.")
        # Fallback synthesizer: Creates a valid 1-second WAV file so client audio playback never breaks
        sample_rate = 16000
        duration = 1.0  # seconds
        num_samples = int(sample_rate * duration)
        with wave.open(output_path, 'w') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            for _ in range(num_samples):
                val = 0
                wav_file.writeframes(struct.pack('<h', val))
        return output_path
