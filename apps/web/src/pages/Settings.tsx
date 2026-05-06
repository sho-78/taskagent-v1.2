export function Settings() {
  return (
    <div>
      <h1 className="text-xl font-medium mb-1">設定</h1>
      <p className="text-sm text-text-secondary mb-6">
        プロフィール、組織、通知、LINE 連携、課金（フェーズ 3 以降）
      </p>
      <div className="space-y-3">
        {[
          "プロフィール",
          "組織管理（F-008 / F-013）",
          "通知設定（F-018）",
          "LINE 連携（F-016）",
          "クロス組織招待（F-017）",
        ].map((label) => (
          <div key={label} className="card flex items-center justify-between">
            <div className="text-sm">{label}</div>
            <button className="btn">編集</button>
          </div>
        ))}
      </div>
    </div>
  );
}
