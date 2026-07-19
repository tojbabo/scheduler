import { PageLayout } from "../layout/PageLayout";

export function Home() {
  return (
    <PageLayout
      eyebrow="Home"
      title="오늘의 일정"
      description="좌측 메뉴에 마우스를 올리면 펼쳐지고, 벗어나면 다시 접힙니다."
    >
      {/* 홈 전용 UI */}
      <p className="page__placeholder">홈 콘텐츠 영역</p>
    </PageLayout>
  );
}
