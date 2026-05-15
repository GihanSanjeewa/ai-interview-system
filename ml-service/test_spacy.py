import spacy

nlp = spacy.load("en_core_web_sm")

text = "React Node.js Python SQL"

doc = nlp(text)

for token in doc:
    print(token.text)