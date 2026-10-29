import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUserId } from "@/lib/session";

export const dynamic = "force-dynamic";
export default async function Contas({ searchParams }: { searchParams: { msg?: string } }) {
  const userId = getUserId(); if (!userId) redirect("/login");
  const accs = await db.socialAccount.findMany({ where: { userId } });
  const card: React.CSSProperties = { background: "#14141f", border: "1px solid #2a2a40", borderRadius: 12, padding: 16 };
  return (
    <main style={{ background: "#0b0b12", color: "#e8e8f0", minHeight: "100vh", padding: 24, fontFamily: "system-ui" }}>
      <h1>Contas do Instagram</h1>
      {searchParams.msg && <p style={{ color: "#a78bfa" }}>{searchParams.msg}</p>}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const a = accs.find((x) => x.slot === n);
          const days = a?.tokenExpiresAt ? Math.ceil((+a.tokenExpiresAt - Date.now()) / 864e5) : null;
          return (
            <section key={n} style={card}>
              <h3>Conta {n}</h3>
              {a ? (<>
                <p>@{a.username} · {a.accountType ?? "?"}</p>
                <p>Estado: {a.status}{days !== null && ``}</p>
                {a.ineligibleReason && <p style={{ color: "#f59e0b" }}>{a.ineligibleReason}</p>}
                <a href={`/api/meta/connect?slot=${n}`}>Reautorizar</a>
                <form method="post" action={`/api/meta/disconnect?slot=${n}`}><button>Desconectar</button></form>
              </>) : (<a href={`/api/meta/connect?slot=${n}`} style={{ color: "#60a5fa" }}>VINCULAR CONTA {n}</a>)}
            </section>
          );
        })}
      </div>
    </main>
  );
}
