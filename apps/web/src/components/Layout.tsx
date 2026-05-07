import { Link, useLocation } from "react-router-dom";
import {
  Home,
  CheckSquare,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "ホーム", icon: Home },
  { to: "/tasks", label: "タスク", icon: CheckSquare },
  { to: "/kpi", label: "KPI", icon: BarChart3 },
  { to: "/settings", label: "設定", icon: SettingsIcon },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, organization, appUser, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r border-border bg-bg-card flex flex-col">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-base font-medium">TaskAgent</div>
          <div className="text-sm text-text-primary mt-1.5 truncate">
            {organization?.name ?? "組織情報を読み込み中..."}
          </div>
          <div className="text-xs text-text-secondary mt-0.5 truncate">
            {appUser?.display_name ?? user?.email ?? ""}
            {appUser?.role === "admin" && (
              <span className="ml-1.5 inline-block px-1.5 py-px text-[10px] rounded bg-bg-sub text-text-secondary">
                管理者
              </span>
            )}
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded text-sm",
                  active
                    ? "bg-bg-sub text-text-primary font-medium"
                    : "text-text-secondary hover:bg-bg-sub"
                )}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={() => signOut()}
          className="m-3 flex items-center gap-2 px-3 py-2 rounded text-sm text-text-secondary hover:bg-bg-sub"
        >
          <LogOut size={16} />
          ログアウト
        </button>
      </aside>
      <main className="flex-1 max-w-[1200px] mx-auto p-6">{children}</main>
    </div>
  );
}
