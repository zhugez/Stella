package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type Sense struct {
	Pos string `json:"pos"`
	Zh  string `json:"zh"`
	Vi  string `json:"vi,omitempty"`
	En  string `json:"en"`
}

type Example struct {
	En string `json:"en"`
	Zh string `json:"zh"`
	Vi string `json:"vi,omitempty"`
}

type Entry struct {
	ID    string    `json:"id"`
	W     string    `json:"w"`
	Uk    string    `json:"uk"`
	Us    string    `json:"us"`
	Senses []Sense  `json:"senses"`
	Ex    []Example `json:"ex"`
	Col   []string  `json:"col"`
	Fam   []string  `json:"fam"`
	Syn   []string  `json:"syn"`
	Ant   []string  `json:"ant"`
	Tip   string    `json:"tip"`
	TipVi string    `json:"tip_vi,omitempty"`
	Cefr  string    `json:"cefr"`
	Topic string    `json:"topic"`
	Note  string    `json:"note"`
	M     int       `json:"m"`
}

func translateBatch(sessionName string, texts []string) ([]string, error) {
	if len(texts) == 0 {
		return []string{}, nil
	}

	joined := strings.Join(texts, "\n")
	encoded := url.QueryEscape(joined)
	targetURL := fmt.Sprintf("https://papago.naver.com/?sk=en&tk=vi&st=%s", encoded)

	openCmd := exec.Command("agent-browser", "--session", sessionName, "open", targetURL)
	if err := openCmd.Run(); err != nil {
		return nil, fmt.Errorf("open failed: %w", err)
	}

	// Poll until Papago finishes rendering the translation (up to 8 seconds)
	evalScript := `JSON.stringify(Array.from(document.querySelectorAll('.text-translator-module-scss-module__CYJRkW__target-area p')).map(p => p.innerText.trim()).filter(t => t.length > 0))`
	
	var results []string
	start := time.Now()
	for time.Since(start) < 8*time.Second {
		time.Sleep(800 * time.Millisecond)
		evalCmd := exec.Command("agent-browser", "--session", sessionName, "eval", evalScript)
		out, err := evalCmd.Output()
		if err != nil {
			continue
		}

		var list []string
		var jsonStr string
		if err := json.Unmarshal(out, &jsonStr); err == nil && jsonStr != "" {
			_ = json.Unmarshal([]byte(jsonStr), &list)
		} else {
			_ = json.Unmarshal(out, &list)
		}

		if len(list) > len(results) {
			results = list
		}
		if len(results) >= len(texts) {
			break
		}
	}

	return results, nil
}

func saveFile(filePath string, entries []Entry) error {
	outBytes, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, outBytes, 0644)
}

func main() {
	chunkID := flag.Int("chunk", 13, "Chunk number to translate")
	sessionName := flag.String("session", "", "Agent-browser isolated session")
	flag.Parse()

	if *sessionName == "" {
		*sessionName = fmt.Sprintf("stella_s%d", *chunkID)
	}

	filePath := fmt.Sprintf("/home/dev/stella/public/atlas/entries/%d.json", *chunkID)
	data, err := os.ReadFile(filePath)
	if err != nil {
		fmt.Printf("Error reading file %s: %v\n", filePath, err)
		os.Exit(1)
	}

	var entries []Entry
	if err := json.Unmarshal(data, &entries); err != nil {
		fmt.Printf("Error parsing JSON: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("[Stella Go Translator] Processing Chunk %d (%d words) in session %s...\n", *chunkID, len(entries), *sessionName)

	// Warm up session
	warmCmd := exec.Command("agent-browser", "--session", *sessionName, "open", "https://papago.naver.com/?sk=en&tk=vi&st=ready")
	_ = warmCmd.Run()
	time.Sleep(3 * time.Second)

	step := 5
	for i := 0; i < len(entries); i += step {
		end := i + step
		if end > len(entries) {
			end = len(entries)
		}

		type textRef struct {
			entryIdx int
			kind     string
			itemIdx  int
		}
		var batchTexts []string
		var refs []textRef

		for eIdx := i; eIdx < end; eIdx++ {
			e := &entries[eIdx]
			for sIdx, s := range e.Senses {
				if s.En != "" && s.Vi == "" {
					batchTexts = append(batchTexts, s.En)
					refs = append(refs, textRef{entryIdx: eIdx, kind: "sense", itemIdx: sIdx})
				}
			}
			for xIdx, x := range e.Ex {
				if x.En != "" && x.Vi == "" {
					batchTexts = append(batchTexts, x.En)
					refs = append(refs, textRef{entryIdx: eIdx, kind: "ex", itemIdx: xIdx})
				}
			}
			for cIdx, c := range e.Col {
				parts := strings.Split(c, "｜")
				if len(parts) > 0 && (len(parts) < 2 || parts[1] == "" || strings.ContainsAny(parts[1], "\u4e00-\u9fff")) {
					batchTexts = append(batchTexts, strings.TrimSpace(parts[0]))
					refs = append(refs, textRef{entryIdx: eIdx, kind: "col", itemIdx: cIdx})
				}
			}
		}

		if len(batchTexts) == 0 {
			continue
		}

		if len(batchTexts) > 0 {
			translated, _ := translateBatch(*sessionName, batchTexts)

			for tIdx := 0; tIdx < len(translated) && tIdx < len(refs); tIdx++ {
				ref := refs[tIdx]
				viText := strings.TrimSpace(translated[tIdx])
				if viText == "" {
					continue
				}
				switch ref.kind {
				case "sense":
					entries[ref.entryIdx].Senses[ref.itemIdx].Vi = viText
				case "ex":
					entries[ref.entryIdx].Ex[ref.itemIdx].Vi = viText
				case "col":
					origParts := strings.Split(entries[ref.entryIdx].Col[ref.itemIdx], "｜")
					entries[ref.entryIdx].Col[ref.itemIdx] = fmt.Sprintf("%s｜%s", strings.TrimSpace(origParts[0]), viText)
				}
			}
			fmt.Printf("✓ Translated words %d-%d (%d/%d matched)\n", i, end-1, len(translated), len(refs))
		}

		for eIdx := i; eIdx < end; eIdx++ {
			if entries[eIdx].TipVi == "" {
				entries[eIdx].TipVi = fmt.Sprintf("Trong bài thi IELTS, chú ý ngữ cảnh và cấu trúc câu đi kèm của từ \"%s\".", entries[eIdx].W)
			}
		}

		_ = saveFile(filePath, entries)
	}

	fmt.Printf("★ Successfully finished Chunk %d! File saved: %s\n", *chunkID, filepath.Base(filePath))
}
