import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
resp = client.models.generate_content(
    model=os.environ["GEMINI_MODEL"],
    contents="Reply with exactly: DealSense LLM is connected.",
)
print(resp.text)