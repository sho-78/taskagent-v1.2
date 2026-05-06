export function Kpi() {
  return (
    <div>
      <h1 className="text-xl font-medium mb-1">KPI ダッシュボード</h1>
      <p className="text-sm text-text-secondary mb-6">
        個人 / 部門 / プロジェクト / 組織の 4 軸で実績を可視化（F-019）
      </p>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "完了タスク", value: "—" },
          { label: "完了率", value: "—" },
          { label: "遅延率", value: "—" },
          { label: "負荷の偏り", value: "—" },
        ].map((m) => (
          <div key={m.label} className="card-muted">
            <div className="text-xs text-text-secondary">{m.label}</div>
            <div className="text-2xl font-medium tabular mt-1">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="text-sm font-medium mb-2">完了タスクの推移</div>
        {/* TODO: Recharts で線グラフを描画。データは kpi_snapshot テーブルから取得 */}
        <div className="text-sm text-text-secondary h-40 flex items-center justify-center">
          グラフ（Recharts で実装予定）
        </div>
      </div>
    </div>
  );
}
