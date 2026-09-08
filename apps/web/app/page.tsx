"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
export default function Login() {
  const r = useRouter();
  const [email, setEmail] = useState("admin@crm.local");
  const [password, setPassword] = useState("Admin@12345");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("crm_token")) r.replace("/dashboard");
  }, [r]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const x = await api<any>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("crm_token", x.accessToken);
      localStorage.setItem("crm_user", JSON.stringify(x.user));
      r.push("/dashboard");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">Real Estate CRM</div>
        <p className="muted">
          Secure sales, lead, plot and payment management.
        </p>
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label htmlFor="page-tsx-email">Email</label>
          <input id="page-tsx-email" name="page-tsx-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="page-tsx-password">Password</label>
          <input id="page-tsx-password" name="page-tsx-password"
            type="password" autoComplete="current-password" required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          className="btn"
          disabled={loading}
          style={{ width: "100%", marginTop: 8 }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
        <p className="muted" style={{ fontSize: 12 }}>
          Demo: admin@crm.local / Admin@12345
        </p>
      </form>
    </main>
  );
}
