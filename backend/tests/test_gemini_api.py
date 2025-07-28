import os
from dotenv import load_dotenv
from google import genai

# Load environment variables from .env file
load_dotenv()

# Get the Gemini API key from environment variable
API_KEY = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')

if not API_KEY:
    print("GEMINI_API_KEY or GOOGLE_API_KEY environment variable not set.")
    exit(1)

# Configure the Gemini API client
try:
    client = genai.Client(api_key=API_KEY)
    prompt = "Hello Gemini! Can you respond to this test prompt?"
    response = client.models.generate_content(model='gemini-2.5-flash', contents=prompt)
    print("Gemini API response:")
    print(response.text)
except Exception as e:
    print(f"Error communicating with Gemini API: {e}")

# List available models
try:
    print("Available Gemini models:")
    for m in client.models.list():
        print(f"- {m.name}")
except Exception as e:
    print(f"Error listing Gemini models: {e}")
