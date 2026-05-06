export function Home() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">ホーム</h1>
        <p className="text-sm text-text-secondary mt-1">
          今日やる 3 件と、AI からの提案がここに表示されます
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "今日のタスク", value: 0 },
          { label: "完了率（今週）", value: "—" },
          { label: "滞留タスク", value: 0 },
        ].map((m) => (
          <div key={m.label} className="card-muted">
            <div className="text-xs text-text-secondary">{m.label}</div>
            <div className="text-2xl font-medium tabular mt-1">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="text-sm font-medium mb-2">優先タスク</div>
        <div className="text-sm text-text-secondary">
          {/* TODO: Supabase からタスクを取得して表示 */}
          タスクがありません。新規作成からタスクを追加してください。
        </div>
      </div>
    </div>
  );
}
