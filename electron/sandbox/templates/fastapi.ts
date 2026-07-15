import type { TemplateConfig } from './types'

export const fastapi: TemplateConfig = {
  id: 'fastapi',
  name: 'FastAPI (Python 3.12)',
  description: 'FastAPI + uvicorn + Pydantic v2,RESTful API 项目',
  triggers: ['fastapi', 'python', 'api', '后端', '后端api', 'pydantic', 'uvicorn', 'restful'],
  devPort: 8000,
  image: 'pipiclaw/sandbox-base:latest',
  files: [
    {
      path: 'requirements.txt',
      content: `fastapi==0.115.0
uvicorn[standard]==0.30.6
pydantic==2.9.2
`,
    },
    {
      path: 'main.py',
      content: `from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title='PiPiClaw FastAPI Sandbox')

class Item(BaseModel):
    name: str
    description: str | None = None

@app.get('/')
async def root():
    return {'message': 'Hello from FastAPI (PiPiClaw sandbox)'}

@app.get('/health')
async def health():
    return {'status': 'ok'}

@app.post('/items')
async def create_item(item: Item):
    return {'name': item.name, 'description': item.description}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
`,
    },
  ],
  startCommand: 'pip install -r requirements.txt && python main.py',
  exposePorts: [8000],
  dependencies: { pip: ['fastapi', 'uvicorn', 'pydantic'] },
  resourceHint: { cpu: 1, memoryMb: 1024 },
}
