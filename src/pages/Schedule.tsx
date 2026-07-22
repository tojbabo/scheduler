import { PageLayout } from "../layout/PageLayout";

export function Schedule() {
  return (
    <PageLayout
      eyebrow="계획"
      title="계획"
      description="계획을 관리하는 화면입니다."
      createLabel="계획 추가"
    >
      <p className="page__placeholder">계획 콘텐츠 영역</p>
    </PageLayout>
  );
}
