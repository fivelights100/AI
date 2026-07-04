## 1. AI 동반자 데스크탑 소개
당신의 삶을 채워 줄 비서임 ㅇㅅㅇ

## 2. AI 동반자 데스크탑 현재 사용 가능한 기능
1. 텍스트 기반의 캐릭터와의 대화
2. 호출어 기반의 캐릭터와의 대화
3. 일정 등록, 삭제

## 3. 각각의 코드 파일 설명
### 3-1 src/main - Electron 창 자체 관리 폴더

#### └ main.js - Electron 앱의 시작점
1. Electron 앱 준비
2. 투명 오버레이 창 생성
3. IPC 등록
4. Ctrl + Space 전역 단축키 등록
5. 앱 종료 시 단축키 해제

---

### 3-2 src/main/window - 데스크탑 오버레이 폴더

#### └ createMainWindow.js - 투명한 데스크탑 오버레이 창 제작
1. 화면 전체 크기의 BrowserWindow 생성
2. 투명 배경 적용
3. 프레임 제거
4. 항상 위 설정
5. 클릭 관통 초기화
6. renderer/index.html 로드

---

### 3-3 src/main/ipc - IPC 폴더

#### └ windowIpc.js - Electron 창 조작 IPC 모음
- set-ignore-mouse-events: 마우스 관통 이벤트
- set-focusable: 창의 포커스
- set-always-on-top: 항상 위

#### └ appDataIpc.js - userData 경로 추출
- 사용자 데이터 저장 위치 추출
- 경로: C:\Users\사용자\AppData\Roaming\앱이름

#### └ whisperIpc.js - OpenAI Whisper API 호출 (사용 안함으로 인한 삭제 예정)

---

### 3-4 src/renderer - 실제 앱 화면과 기능

#### └ index.html - Electron 창 안에 표시되는 실제 HTML
1. Live2D canvas
2. 자막 박스
3. 채팅 입력창
4. 메뉴 버튼
5. 통합 대시보드 UI
6. 외부 라이브러리 로드
7. renderer.js 실행

#### └ renderer.js - 여러 모듈을 연결하는 오케스트레이터
1. UI 초기화
2. Live2D 캐릭터 초기화
3. Ctrl + Space 이벤트 처리
4. 채팅 입력 처리
5. 호출어/STT 초기화

---

### 3-5 src/renderer/config - 서버 주소와 API 경로 폴더

#### └ appConfig.js - 서버 주소와 API 경로 관리
- DEFAULT_SERVER_BASE_URL: http://localhost:3000
- status: /api/status
- chat: /api/chat
- schedules: /api/schedules
- stt: /api/stt
- model: /models/hiyori_ex/runtime/hiyori_free_t08.model3.json

---

### 3-6 src/renderer/ai - AI 관련 폴더

#### └ aiClient.js - AI 서버와의 통신만 담당
- /api/chat: 메시지와 채팅 내역만 전송

#### └ aiOrchestrator.js - AI 대화 전체 흐름 조율
1. 최근 대화 기록 정리
2. 서버로 메시지 전송
3. 응답을 chatHistory에 저장
4. 자막 표시
5. 일정 변경 시 일정 목록 갱신
6. audio_base64가 있으면 음성 재생 + 립싱크
7. 오류 시 안내 자막 표시

---

### 3-7 src/renderer/companion - Live2D 캐릭터와 음성/립싱크 관련 폴더

#### └ characterEngine.js - Live2D 캐릭터 모델 로딩 및 상호작용 담당
1. PIXI Application 생성
2. Live2D 모델 로딩
3. 저장된 위치/크기/회전 적용
4. 마우스 호버 감지
5. 캐릭터 드래그 이동
6. 우클릭으로 대시보드 열기
7. 마우스 관통 제어
8. 입 모양 파라미터 업데이트

#### └ audioPlayer.js - 서버가 보내준 audio_base64를 실제 소리로 재생
- 소리 재생
- 음량 분석
- 입 모양 업데이트

#### └ lipSync.js - 음성 분석 데이터를 입 모양 값으로 변환
- 값: 0 ~ 1 사이 정규화
- 소리가 클수록 입이 더 벌어짐
- 소리가 끝나면 입이 닫힘

---

### 3-8 src/renderer/speech - 음성 입력 담당 폴더

#### └ sttEngine.js - 음성 입력 전체 흐름을 조율 담당
1. 호출어 모델 초기화
2. 호출어 감지 시작
3. 호출어가 감지되면 감지 일시 중지
4. 녹음 시작
5. 침묵 감지 후 녹음 종료
6. 서버 /api/stt로 오디오 전송
7. 텍스트 결과 반환
8. 다시 호출어 감지 재시작

#### └ wakeWord.js - TensorFlow Speech Commands 모델을 이용해 호출어를 감지
- wakeWordIndex: 모델 라벨 중 몇 번째 단어를 호출어로 볼지
- wakeThreshold: 호출어 점수가 몇 이상이면 감지할지
- probabilityThreshold: 내부 인식 최소 확률
- overlapFactor: 분석 창이 얼마나 겹쳐서 실행될지

#### └ recorder.js - 마이크로 음성 녹음 및 침묵 감지 시 자동 종료
1. MediaRecorder 생성
2. 녹음 시작
3. detectSilence로 음량 감시
4. 조용하면 recorder.stop()
5. Blob 반환

#### └ sttClient.js - 녹음된 오디오를 서버로 전송
- 데스크탑: 오디오 파일만 서버로 보냄
- 서버: OpenAI Whisper 호출

---

### 3-9 src/renderer/ui - UI 담당 폴더

#### └ dashboard.js - 대시보드 안 탭 전환 담당
- 큰 탭: 관리, 설정, 정보
- 작은 탭: 대화 목록, 일정 목록, 화면, 소리, 시스템 등

#### └ uiController.js - 앱의 주요 UI를 제어
1. 자막 타이핑 효과
2. 대화 기록 렌더링
3. 일정 목록 렌더링
4. 일정 삭제 처리
5. 서버 상태 표시
6. 서버 주소 저장
7. 대시보드 열기/닫기
8. UI 영역을 마우스 관통 예외 대상으로 제공

---

### 3-10 src/renderer/schedules - 일정 관련 폴더

#### scheduleClient.js - 서버 일정 API 통신 담당
- 일정 조회
- 일정 삭제

---

### 3-11 src/renderer/system - 서버 관련 폴더

#### serverStatusClient.js - 서버 상태 API 호출 담당
- 서버 상태

---

### 3-12 src/renderer/storage - 스토리지 관련 폴더

#### configManager.js - 앱 설정과 대화 기록을 저장/로드 담당
- appSettings: 앱 내 설정
- chatHistory: 이전 채팅 기억

---

### 3-13 src/renderer/styles - 디자인 관련 폴더

#### index.css - 전체 UI 스타일 담당
- 투명 배경
- Live2D canvas 전체화면
- 자막 박스
- 채팅 입력창
- 메뉴 버튼
- 대시보드 오버레이
- 대시보드 탭
- 대화/일정 카드
- 시스템 상태 카드
- 설정 입력창

## 4. 업데이트 사항
null









