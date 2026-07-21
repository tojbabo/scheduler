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

# Tauri 데스크톱 앱 빌드 (설치 파일 / .exe 생성)
npm run tauri:build
```

### 더블클릭용 스크립트 (권장)

프로젝트 루트의 bat 파일을 더블클릭하면 됩니다.

| 스크립트 | 하는 일 |
|----------|---------|
| `빌드.bat` | 앱을 빌드한 뒤 프로젝트 루트에 `Scheduler.exe` 생성 |
| `실행.bat` | 프로젝트 루트의 `Scheduler.exe` 실행 (없으면 빌드 결과물로 시도) |

같은 작업을 npm으로도 할 수 있습니다.

```bash
npm run app:build   # 빌드 → ./Scheduler.exe
npm run app:run     # 실행만
```

평소 사용 흐름:

1. 코드 수정 후 → `빌드.bat` 한 번
2. 이후에는 → `실행.bat` 또는 `Scheduler.exe` 더블클릭

### 빌드 산출물 직접 찾기

`npm run tauri:build`만 실행한 경우:

| 파일 | 경로 (대략) |
|------|-------------|
| 앱 실행 파일 | `src-tauri/target/release/scheduler.exe` |
| 설치 프로그램 | `src-tauri/target/release/bundle/nsis/` |

> 빌드는 Node + Rust + VS Build Tools가 있는 PC에서만 하면 됩니다.  
> 코드 수정 후에는 다시 `빌드.bat`(또는 `npm run app:build`)를 실행해야 반영됩니다.  
> `Scheduler.exe`는 로컬 산출물이라 git에 올리지 않습니다.

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

### 문제 해결: `cargo` / `program not found`

Rust를 막 설치했다면 **터미널(또는 Cursor)을 한 번 종료했다가 다시 연 뒤** 재시도하세요.  
`cargo`가 PATH에 없으면 Tauri가 위 오류를 냅니다.

확인:

```bash
cargo --version
```

없으면 [rustup](https://rustup.rs/)으로 Rust를 설치하고, 설치 후 터미널을 재시작하세요.  
이 프로젝트의 `npm run tauri:dev`는 `~/.cargo/bin`을 PATH에 자동으로 붙이도록 되어 있습니다.

## 데이터 모델 (SQLite)

앱은 SQLite 파일 DB를 사용합니다. 스키마 정의는 `src-tauri/schema/schema.sql`이며, 앱 시작 시 없는 테이블을 생성합니다.

| 구분 | MySQL에 비유 | 이 프로젝트 |
|------|--------------|-------------|
| 데이터베이스 | `mydb` | `scheduler.db` 파일 하나 |
| 테이블 | `mytable` | `tasks`, `events` 등 |

기본 DB 파일 위치 (Windows):

```text
%APPDATA%\com.ojjj.scheduler\scheduler.db
```

터미널에서 확인 예:

```bash
sqlite3 "$env:APPDATA/com.ojjj.scheduler/scheduler.db"
```

### 개념: `tasks` vs `events`

| 테이블 | 의미 | 예시 |
|--------|------|------|
| **tasks** | 무기한으로 해야 할 일 (할 일) | 보고서 작성, 공부하기 |
| **events** | 특정 시점에 발생하는 일 (약속·일정) | 회의 14:00, 생일 |

### `tasks` — 할 일

트리 구조(`parent_id`)로 하위 할 일을 둘 수 있습니다.

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| `id` | INTEGER PK, AUTOINCREMENT | 아니오 | 식별자. DB에는 1, 2, 3… 저장, UI에서는 `00001`처럼 패딩 표시 |
| `title` | TEXT | 아니오 | 제목 |
| `description` | TEXT | 예 | 설명 |
| `created_at` | TEXT | 아니오 | 작성 일시 (ISO 8601, 예: `2026-07-19T17:16:00`) |
| `parent_id` | INTEGER FK → `tasks.id` | 예 | 부모 할 일. 없으면 루트. 부모 삭제 시 자식도 삭제(CASCADE) |
| `state` | INTEGER | 아니오 | 상태 코드. 기본값 `3`(예정) |

**`state` 코드**

| 값 | 의미 |
|----|------|
| `0` | 시작 전 |
| `1` | 진행 중 |
| `2` | 중단 |
| `3` | 완료 |

### `events` — 일정·약속

시작/종료 시각이 있는 타임라인 항목입니다.

| 컬럼 | 타입 | NULL | 설명 |
|------|------|------|------|
| `id` | INTEGER PK, AUTOINCREMENT | 아니오 | 식별자 (표시 시 패딩 동일) |
| `created_at` | TEXT | 아니오 | 등록 일시 |
| `updated_at` | TEXT | 아니오 | 수정 일시 (최초에는 `created_at`과 동일) |
| `starts_at` | TEXT | 예 | 스케줄 시작 (연월일시분) |
| `ends_at` | TEXT | 예 | 스케줄 종료 (연월일시분) |
| `title` | TEXT | 아니오 | 제목 |
| `description` | TEXT | 예 | 설명 |
| `category_id` | INTEGER FK → `categories.id` | 예 | 카테고리. 카테고리 삭제 시 NULL로 유지 |

### 관련 테이블 (참고)

- **`categories`** — `events` 분류용. `id`, `name`, `created_at`, `updated_at`
- **`schema_meta`** — 스키마 버전 등 메타 (`version` 키). 이후 마이그레이션 판단용

스키마를 바꿀 때는 `src-tauri/schema/schema.sql`을 수정합니다.  
`CREATE TABLE IF NOT EXISTS`는 **없을 때만** 만들므로, 이미 있는 테이블의 컬럼을 바꾸려면 DB를 직접 조정하거나 마이그레이션이 필요합니다.

## 폴더 구조

```
scheduler/
├── src/                    # React 프론트엔드
│   ├── App.tsx             # 메인 UI
│   ├── App.css             # 스타일
│   ├── main.tsx            # React 진입점
│   ├── bridge/             # Tauri/데이터 호출 경계
│   └── assets/             # 프론트엔드 정적 에셋
├── public/                 # Vite가 그대로 서빙하는 공용 파일
├── src-tauri/              # Tauri / Rust 백엔드
│   ├── schema/
│   │   └── schema.sql      # SQLite 테이블 정의
│   ├── src/
│   │   ├── main.rs         # 네이티브 실행 진입점
│   │   ├── lib.rs          # 앱 초기화, Rust 커맨드 정의
│   │   └── db/             # DB 인터페이스·SQLite 구현
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
- **`src-tauri/schema/schema.sql`** — SQLite 테이블 정의의 출처입니다.
- **`public/`** — 빌드 시 변환 없이 복사되는 정적 파일입니다.
- **`package.json`** — 개발/빌드 npm 스크립트의 기준점입니다.

## IDE 추천

- [VS Code](https://code.visualstudio.com/) 또는 Cursor
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
