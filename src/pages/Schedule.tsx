import { PageLayout } from "../layout/PageLayout";

export function Schedule() {
  return (
    <PageLayout
      eyebrow="Task"
      title="할 일"
      description="할 일을 관리하는 화면입니다."
    >
      <p className="page__placeholder">할 일 콘텐츠 영역</p>
    </PageLayout>
  );
}
