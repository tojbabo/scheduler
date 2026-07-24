import { useState } from "react";
import { PlanList } from "../components/PlanList";
import { PageLayout } from "../layout/PageLayout";

export function Schedule() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <PageLayout
      eyebrow="계획"
      title="계획"
      createLabel="계획 추가"
      createKind="plan"
      onTaskCreated={() => setRefreshKey((key) => key + 1)}
    >
      <PlanList interactive refreshKey={refreshKey} />
    </PageLayout>
  );
}
