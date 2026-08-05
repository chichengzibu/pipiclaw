"""Check Ollama status"""
import urllib.request
import json

try:
    r = urllib.request.urlopen('http://localhost:11434/api/tags', timeout=3)
    data = json.loads(r.read())
    print('Ollama OK')
    for m in data.get('models', []):
        size_gb = m.get('size', 0) / 1024**3
        print(f'  - {m["name"]} ({size_gb:.1f}GB)')
except Exception as e:
    print(f'FAIL: {e}')
