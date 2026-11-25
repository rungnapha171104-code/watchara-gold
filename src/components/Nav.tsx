"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarCheck, Camera, LayoutDashboard, LogOut } from "lucide-react";

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  if (path === "/login") return null;
  const link = (href: string, label: string, Icon: typeof Camera) => (
    <Link href={href} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm ${path === href ? "bg-gold-50 font-semibold text-gold-600" : "text-gray-600 hover:bg-gray-100"}`}>
      <Icon size={16} /> {label}
    </Link>
  );
  return (
    <header className="border-b border-gold-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3 py-2 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gold-500">Watchara Gold</span>
        </div>
        <nav className="flex items-center gap-1">
          {link("/", "ประวัติบิล", LayoutDashboard)}
          {link("/daily", "สรุปรายวัน", CalendarCheck)}
          {link("/scan", "สแกนบิล", Camera)}
          <button
            className="ml-1 rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            title="ออกจากระบบ"
            onClick={async () => { await fetch("/api/auth", { method: "DELETE" }); router.push("/login"); }}
          >
            <LogOut size={16} />
          </button>
        </nav>
      </div>
    </header>
  );
}
