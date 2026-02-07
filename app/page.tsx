import { SearchClient } from "@/components/search-client";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <p className="heroBadge">HotRise MVP</p>
        <h1>伸び始め動画を、先に見つける</h1>
        <p className="heroLead">
          YouTubeの候補を収集し、<strong>views/subscribers</strong> で再ランキング。勢いが強い動画を素早く把握できます。
        </p>
      </section>
      <SearchClient />
    </main>
  );
}
