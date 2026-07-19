import { PageLayout } from "../layout/PageLayout";

export function Schedule() {
  return (
    <PageLayout
      eyebrow="Schedule"
      title="일정"
      description="이벤트와 약속을 관리하는 화면입니다."
    >
      <p className="page__placeholder">일정 콘텐츠 영역</p>
    </PageLayout>
  );
}
