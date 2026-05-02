type AdSlotProps = {
  title?: string;
  body?: string;
  cta?: string;
};

export function NativeAdSlot({
  title = "ここにネイティブ広告が入ります",
  body = "公開後はこの枠にネイティブ広告コードを差し込めます。",
  cta = "詳しく見る"
}: AdSlotProps) {
  return (
    <section className="native-ad-card" aria-label="広告">
      <div className="ad-label">広告</div>
      <div className="native-ad-body">
        <div className="native-ad-copy">
          <p className="native-ad-title">{title}</p>
          <p className="native-ad-text">{body}</p>
        </div>
        <button className="native-ad-cta" type="button">
          {cta}
        </button>
      </div>
    </section>
  );
}

export function BannerAdSlot() {
  return (
    <section className="banner-ad-card" aria-label="バナー広告">
      <div className="ad-label">広告</div>
      <div className="banner-ad-body">
        <span className="banner-ad-text">ここにバナー広告が入ります</span>
      </div>
    </section>
  );
}
