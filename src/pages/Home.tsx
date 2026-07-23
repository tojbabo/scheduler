import { EventList } from "../components/EventList";
import { PlanList } from "../components/PlanList";
import { PageLayout } from "../layout/PageLayout";

export function Home() {
  return (
    <PageLayout
      eyebrow="Home"
      title="오늘의 일정"
      description="좌측 메뉴에 마우스를 올리면 펼쳐지고, 벗어나면 다시 접힙니다."
    >
      <div className="home-split">
        <section className="home-panel" aria-labelledby="home-plans-heading">
          <h3 id="home-plans-heading" className="home-panel__title">
            계획
          </h3>
          <PlanList interactive={false} />
        </section>

        <section className="home-panel" aria-labelledby="home-upcoming-heading">
          <h3 id="home-upcoming-heading" className="home-panel__title">
            다가올 일정
          </h3>
          <EventList />
        </section>
      </div>
    </PageLayout>
  );
}
