"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/auth", { method: "POST", body: JSON.stringify({ passcode: code }) });
    if (r.ok) { router.push("/"); router.refresh(); } else setErr("รหัสไม่ถูกต้อง");
  }
  return (
    <form onSubmit={submit} className="card mx-auto mt-24 max-w-sm space-y-4 text-center">
      <h1 className="text-xl font-bold text-gold-500">Watchara Gold</h1>
      <p className="text-sm text-gray-500">กรอกรหัสผ่านร้านเพื่อเข้าใช้งาน</p>
      <input type="password" inputMode="numeric" autoFocus className="input text-center text-lg tracking-widest" value={code} onChange={(e) => setCode(e.target.value)} />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className="btn-gold w-full">เข้าสู่ระบบ</button>
    </form>
  );
}
