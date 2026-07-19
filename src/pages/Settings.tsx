import { PageLayout } from "../layout/PageLayout";

export function Settings() {
  return (
    <PageLayout
      eyebrow="Settings"
      title="설정"
      description="앱 환경과 표시 옵션을 조정합니다."
    >
      <p className="page__placeholder">설정 콘텐츠 영역</p>
    </PageLayout>
  );
}
