import { PageLayout } from "../layout/PageLayout";

export function Calendar() {
  return (
    <PageLayout
      eyebrow="Calendar"
      title="캘린더"
      description="달력 형태로 일정을 보는 화면입니다."
    >
      <p className="page__placeholder">캘린더 콘텐츠 영역</p>
    </PageLayout>
  );
}
