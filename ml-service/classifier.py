"""
Machine Learning performance classifier using scikit-learn.
Trains a RandomForestClassifier in-memory on a synthetic high-fidelity dataset
representing Beginner, Intermediate, and Advanced candidates.
"""

import numpy as np

try:
    from sklearn.ensemble import RandomForestClassifier
    SKLEARN_AVAILABLE = True
except Exception:
    SKLEARN_AVAILABLE = False
    RandomForestClassifier = None

# Global model instance
_model = None
_classes = {0: "Beginner", 1: "Intermediate", 2: "Advanced"}

def train_classifier():
    """
    Generate synthetic data and train a RandomForestClassifier.
    Feature vector shape (21 features):
    [wpm, confidence, fluency, speaking_speed_score, mean_rms, f0_mean, f0_std, silence_ratio, mfcc1..13_mean]
    """
    global _model
    np.random.seed(42)
    
    num_samples = 1500
    X = []
    y = []

    for _ in range(num_samples):
        # Pick a target class: 0 (Beginner), 1 (Intermediate), 2 (Advanced)
        cls = np.random.choice([0, 1, 2], p=[0.3, 0.4, 0.3])
        
        # 13 MFCCs means
        mfccs = np.random.normal(loc=0.0, scale=1.0, size=13)
        
        if cls == 0:  # Beginner
            wpm = np.random.uniform(40.0, 90.0)
            confidence = np.random.uniform(20.0, 55.0)
            fluency = np.random.uniform(20.0, 55.0)
            speed_score = np.random.uniform(20.0, 60.0)
            mean_rms = np.random.uniform(0.01, 0.04)
            f0_mean = np.random.uniform(90.0, 150.0)
            f0_std = np.random.uniform(15.0, 40.0)  # high variance (shaky voice)
            silence_ratio = np.random.uniform(0.35, 0.60) # high silence ratio
            # Shift MFCCs down a bit to represent poor articulation
            mfccs -= 0.5
        elif cls == 1:  # Intermediate
            wpm = np.random.uniform(90.0, 130.0)
            confidence = np.random.uniform(55.0, 80.0)
            fluency = np.random.uniform(55.0, 80.0)
            speed_score = np.random.uniform(60.0, 85.0)
            mean_rms = np.random.uniform(0.04, 0.10)
            f0_mean = np.random.uniform(120.0, 200.0)
            f0_std = np.random.uniform(5.0, 15.0)
            silence_ratio = np.random.uniform(0.18, 0.35)
        else:  # Advanced
            wpm = np.random.uniform(130.0, 175.0)
            confidence = np.random.uniform(80.0, 100.0)
            fluency = np.random.uniform(80.0, 100.0)
            speed_score = np.random.uniform(85.0, 100.0)
            mean_rms = np.random.uniform(0.08, 0.18)
            f0_mean = np.random.uniform(130.0, 220.0)
            f0_std = np.random.uniform(1.0, 6.0) # very stable pitch
            silence_ratio = np.random.uniform(0.10, 0.22)
            # Shift MFCCs up representing strong articulation
            mfccs += 0.5
            
        feats = [
            wpm, confidence, fluency, speed_score,
            mean_rms, f0_mean, f0_std, silence_ratio
        ] + list(mfccs)
        
        X.append(feats)
        y.append(cls)
        
    X = np.array(X)
    y = np.array(y)
    
    # Train the Random Forest
    if not SKLEARN_AVAILABLE or RandomForestClassifier is None:
        _model = "heuristic"
        return

    clf = RandomForestClassifier(n_estimators=100, max_depth=8, random_state=42)
    clf.fit(X, y)
    
    _model = clf
    print("RandomForest Classifier trained successfully in-memory.")

def classify_candidate_performance(feature_vector: list) -> str:
    """
    Classify the candidate based on their average audio/text feature vector.
    Falls back gracefully if model is not trained.
    """
    global _model
    if _model is None:
        train_classifier()
        
    if _model == "heuristic" or not SKLEARN_AVAILABLE:
        avg_score = (feature_vector[1] + feature_vector[2]) / 2 if len(feature_vector) > 2 else 70
        if avg_score < 55:
            return "Beginner"
        elif avg_score < 80:
            return "Intermediate"
        return "Advanced"

    try:
        # Reshape for prediction
        x_in = np.array(feature_vector).reshape(1, -1)
        pred = _model.predict(x_in)[0]
        return _classes.get(pred, "Intermediate")
    except Exception as e:
        print(f"Classifier prediction error: {e}")
        # Robust mathematical fallback logic if prediction fails
        # Blend confidence and fluency
        avg_score = (feature_vector[1] + feature_vector[2]) / 2 if len(feature_vector) > 2 else 70
        if avg_score < 55:
            return "Beginner"
        elif avg_score < 80:
            return "Intermediate"
        else:
            return "Advanced"

# Initialize model on import
train_classifier()

