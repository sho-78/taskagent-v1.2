export function Tasks() {
  return (
    <div>
      <h1 className="text-xl font-medium mb-1">タスク</h1>
      <p className="text-sm text-text-secondary mb-6">
        リスト / カンバン / カレンダーの 3 ビューをここで切り替え
      </p>
      <div className="card">
        {/* TODO: タスク一覧の実装。Supabase から task テーブルを RLS 越しに取得 */}
        <div className="text-sm text-text-secondary">
          タスク一覧をここに実装します（F-001 / F-002）
        </div>
      </div>
    </div>
  );
}
