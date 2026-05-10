import pdfplumber

with pdfplumber.open("cv.pdf") as pdf:
    text = ""
    
    for page in pdf.pages:
        text += page.extract_text()

print(text)