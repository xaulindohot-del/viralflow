"use client";
import { useState } from "react";
export default function Login() {
  const [e, setE] = useState(""), [p, setP] = useState(""), [m, setM] = useState("");
  const go = async (action: "login" | "register") => {
    const r = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, email: e, password: p }) });
    if (r.ok) location.href = "/contas"; else setM((await r.json()).error);
  };
  return (<main style={{ background: "#0b0b12", color: "#e8e8f0", minHeight: "100vh", padding: 24, fontFamily: "system-ui" }}>
    <h1>ViralFlow</h1>
    <input placeholder="e-mail" value={e} onChange={(x) => setE(x.target.value)} /><br />
    <input type="password" placeholder="senha (mín. 10)" value={p} onChange={(x) => setP(x.target.value)} /><br />
    <button onClick={() => go("login")}>Entrar</button> <button onClick={() => go("register")}>Criar proprietário (1º acesso)</button>
    <p style={{ color: "#f87171" }}>{m}</p></main>);
}
