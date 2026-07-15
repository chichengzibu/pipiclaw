import type { TemplateConfig } from './types'

export const goHttp: TemplateConfig = {
  id: 'go-http',
  name: 'Go HTTP Server',
  description: 'Go 1.23 net/http + 标准库 RESTful API',
  triggers: ['go', 'golang', 'go-http', '后端go', '微服务go', 'restful-go'],
  devPort: 8080,
  image: 'pipiclaw/sandbox-base:latest',
  files: [
    {
      path: 'main.go',
      content: `package main

import (
	"encoding/json"
	"log"
	"net/http"
)

type Item struct {
	Name        string \`json:"name"\`
	Description string \`json:"description,omitempty"\`
}

func main() {
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message": "Hello from Go HTTP (PiPiClaw sandbox)",
		})
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	http.HandleFunc("/items", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var item Item
		if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(item)
	})

	log.Println("listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
`,
    },
    {
      path: 'go.mod',
      content: `module pipiclaw-go-sandbox

go 1.23
`,
    },
  ],
  startCommand: 'go run main.go',
  exposePorts: [8080],
  dependencies: { go: [] },
  resourceHint: { cpu: 1, memoryMb: 512 },
}
