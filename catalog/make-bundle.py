#!/usr/bin/env python3
"""카탈로그 전달용 묶음(zip) 만들기 — 저장소 없이도 다른 사람(다른 Claude 사용자)이 이어서 수정할 수 있게.

사용 (저장소 맨 위 폴더에서):  python3 catalog/make-bundle.py
결과: catalog/dist/caribe-catalog-source.zip

묶음 안의 폴더 구조는 저장소와 같아서(맨 위 = 데이터 파일, catalog/ = 카탈로그) 코드를 고치지 않고 그대로 동작합니다.
홈페이지 코드·서버 함수·회원 데이터 등 카탈로그에 필요 없는 파일은 넣지 않습니다.
"""
import os, zipfile, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "catalog", "dist")
OUT = os.path.join(OUT_DIR, "caribe-catalog-source.zip")

# 카탈로그가 읽는 저장소 파일 (catalog/index.html 의 <script> 와 catalog.js 의 이미지 경로)
SHARED = [
    "catalog-data.js", "data.js", "core.js",
    "data/research-papers.js", "data/literature-measurements.js", "data/test-plan.js",
    "assets/logo-navy.png",
    "assets/chaos-before.jpg", "assets/chaos-diag.jpg", "assets/chaos-type-a.jpg", "assets/chaos-type-b.jpg",
    "assets/fit-red-caliper.jpg", "assets/fit-yellow-caliper.jpg", "assets/fit-installed.jpg",
    "images/brake-discs/hero-disc-a.png", "images/brake-discs/hero-disc-b.png",
]
SKIP_DIRS = {"dist", "node_modules"}

README = """카리브무역 B2B 브레이크 디스크 카탈로그 — 수정용 묶음 ({date})

이 폴더를 Claude(Claude Code 등)에 올리고 "catalog/CLAUDE.md 를 읽고 카탈로그를 수정해 줘"라고 요청하면 됩니다.
- 수정 규칙·구조·PDF 만드는 법: catalog/CLAUDE.md
- 사람이 직접 볼 때: catalog/README.md
- 완성 PDF: catalog/caribe-catalog.pdf

바로 보기 (Node.js 18 이상):
  node catalog/server.js      → 브라우저에서 http://localhost:4000
PDF 다시 만들기 (Playwright 필요: npm i -D playwright && npx playwright install chromium):
  node catalog/build-pdf.js
"""

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    files = []
    for rel in SHARED:
        if not os.path.isfile(os.path.join(ROOT, rel)):
            raise SystemExit("빠진 파일: " + rel)
        files.append(rel)
    for base, dirs, names in os.walk(os.path.join(ROOT, "catalog")):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
        for n in names:
            if n.startswith("."):
                continue
            files.append(os.path.relpath(os.path.join(base, n), ROOT))
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for rel in sorted(set(files)):
            z.write(os.path.join(ROOT, rel), "caribe-catalog/" + rel.replace(os.sep, "/"))
        z.writestr("caribe-catalog/README.txt", README.format(date=datetime.date.today().isoformat()))
        z.writestr("caribe-catalog/CLAUDE.md", "카탈로그 작업 안내는 catalog/CLAUDE.md 에 있습니다. 먼저 그 파일을 읽으세요.\n")
        z.writestr("caribe-catalog/package.json", '{\n  "name": "caribe-catalog",\n  "private": true,\n  "scripts": {\n    "start": "node catalog/server.js",\n    "pdf": "node catalog/build-pdf.js"\n  },\n  "engines": { "node": ">=18" }\n}\n')
    print("저장:", OUT, f"({len(set(files))}개 파일, {os.path.getsize(OUT)//1024} KB)")

if __name__ == "__main__":
    main()
