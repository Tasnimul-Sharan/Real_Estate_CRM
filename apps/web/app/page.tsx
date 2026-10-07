"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import Icon from "@/components/Icon";
import { api } from "@/lib/api";
export default function Login() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      <section className="login-story">
        <div className="brand-lockup"><BrandLogo priority /></div>
        <div className="login-message"><div className="eyebrow">SPACE FOR YOUR BUSINESS TO GROW</div><h1>Great properties.<br />Stronger relationships.</h1><p>Bring your people, properties and sales together in one thoughtfully organized workspace.</p><div className="login-features"><div><Icon name="leads" size={19} /> Turn conversations into opportunities</div><div><Icon name="plots" size={19} /> Keep your property portfolio in view</div><div><Icon name="wallet" size={19} /> Stay on top of bookings and collections</div></div></div>
        <div className="login-story-footer">ANONDO HOUSING SOCIETY · YOUR BUSINESS, CONNECTED.</div><div className="login-decoration" />
      </section>
      <div className="login-panel"><form className="login-card" onSubmit={submit}>
        <span className="login-greeting"><Icon name="home" size={24} /></span><h2>Welcome back.</h2><p>Sign in to your Anondo Housing workspace.</p>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="field"><label htmlFor="login-email">Email address</label><input id="login-email" name="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} /></div>
        <div className="field"><label htmlFor="login-password">Password</label><input id="login-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} /></div>
        <button className="btn" disabled={loading}>{loading ? "Signing in..." : "Sign in"}<Icon name="arrow" size={17} /></button>
        <div className="demo-note"><Icon name="shield" size={16} /><div><strong>Your workspace is private.</strong><br />Use the credentials supplied by your administrator.</div></div>
      </form></div>
    </main>
  );
}
