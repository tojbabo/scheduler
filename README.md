# Scheduler

React + Tauri 2 기반 Windows 데스크톱 스케줄러 앱입니다.

| 구분 | 기술 |
|------|------|
| Frontend | React 19, TypeScript, Vite |
| Desktop | Tauri 2 (Rust) |
| Platform | Windows (WebView2) |

## 사전 요구사항

- Node.js 18+
- Rust (`rustup` / stable)
- Visual Studio 2022 Build Tools — **Desktop development with C++** 워크로드
- Microsoft Edge WebView2 Runtime (Windows 10/11에는 보통 포함)

## 명령어 모음

### 최초 설정

```bash
npm install
```

### 개발 실행

```bash
# Tauri 윈도우에서 실행 (권장)
npm run tauri:dev

# Vite만 브라우저에서 실행 (UI 작업용)
npm run dev
```

### 빌드

```bash
# 프론트엔드만 빌드 (TypeScript 검사 + Vite)
npm run build

# Tauri 데스크톱 앱 빌드 (설치 파일 생성)
npm run tauri:build
```

### 기타

```bash
# 프론트엔드 프로덕션 미리보기
npm run preview

# Tauri CLI 직접 호출
npm run tauri -- --help
```

| 명령 | 설명 |
|------|------|
| `npm install` | 의존성 설치 |
| `npm run tauri:dev` | 데스크톱 앱 개발 모드 (핫리로드) |
| `npm run dev` | 브라우저에서 Vite만 실행 |
| `npm run build` | 프론트엔드 프로덕션 빌드 |
| `npm run tauri:build` | Windows용 네이티브 번들/설치 파일 생성 |
| `npm run preview` | 빌드된 프론트엔드 미리보기 |

> 첫 `tauri:dev` / `tauri:build`는 Rust 의존성 컴파일 때문에 시간이 더 걸립니다. 이후에는 캐시되어 훨씬 빠릅니다.

## 폴더 구조

```
scheduler/
├── src/                    # React 프론트엔드
│   ├── App.tsx             # 메인 UI
│   ├── App.css             # 스타일
│   ├── main.tsx            # React 진입점
│   └── assets/             # 프론트엔드 정적 에셋
├── public/                 # Vite가 그대로 서빙하는 공용 파일
├── src-tauri/              # Tauri / Rust 백엔드
│   ├── src/
│   │   ├── main.rs         # 네이티브 실행 진입점
│   │   └── lib.rs          # 앱 초기화, Rust 커맨드 정의
│   ├── capabilities/       # 앱 권한(capabilities) 설정
│   ├── icons/              # 앱/설치 패키지 아이콘
│   ├── Cargo.toml          # Rust 의존성
│   └── tauri.conf.json     # 윈도우 크기, 번들, 빌드 설정
├── index.html              # HTML 진입점
├── package.json            # npm 스크립트 / 프론트 의존성
├── vite.config.ts          # Vite 설정
└── tsconfig.json           # TypeScript 설정
```

### 역할 요약

- **`src/`** — UI와 프론트엔드 로직. Tauri API(`invoke` 등)로 Rust 기능을 호출합니다.
- **`src-tauri/`** — 네이티브 셸, 시스템 API, 빌드/번들 설정이 들어 있습니다.
- **`public/`** — 빌드 시 변환 없이 복사되는 정적 파일입니다.
- **`package.json`** — 개발/빌드 npm 스크립트의 기준점입니다.

## IDE 추천

- [VS Code](https://code.visualstudio.com/) 또는 Cursor
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
