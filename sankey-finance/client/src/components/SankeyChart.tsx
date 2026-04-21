import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { sankey as d3Sankey, sankeyLinkHorizontal, sankeyLeft } from "d3-sankey";
import { useTheme } from "@/context/ThemeContext";
import type { Account } from "@shared/schema";

interface CategoryBucket {
  name: string;
  color: string;
  total: number;
}

interface AccountSummary {
  account: Account;
  totalIncome: number;
  totalExpenses: number;
  incomeByCategory: Record<number, CategoryBucket>;
  expenseByCategory: Record<number, CategoryBucket>;
  transfersOut: Record<number, number>;
}

interface Props {
  accountSummaries: Record<number, AccountSummary>;
  accounts: Account[];
  totalIncome: number;
  totalExpenses: number;
}

function fmt(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

export default function SankeyChart({ accountSummaries, accounts, totalIncome, totalExpenses }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const colors = {
    label:        isDark ? "#c9c8c6" : "#374151",
    incomeVal:    isDark ? "#6daa45" : "#15803d",
    expenseVal:   isDark ? "#f87171" : "#dc2626",
    accountLabel: isDark ? "#e2e1df" : "#111827",
    accountVal:   isDark ? "#797876" : "#6b7280",
    centerLabel:  isDark ? "#4f98a3" : "#0e7490",
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    if (accounts.length === 0) return;

    // Collect all unique income categories and expense categories across all accounts
    const incomeCats: Map<string, { color: string; total: number }> = new Map();
    const expenseCats: Map<string, { color: string; total: number }> = new Map();
    const accountNodes: { id: string; label: string; color: string; total: number }[] = [];
    const transferLinks: { from: number; to: number; amount: number }[] = [];

    for (const acc of accounts) {
      const sum = accountSummaries[acc.id];
      if (!sum) continue;
      const netFlow = sum.totalIncome - sum.totalExpenses;
      if (sum.totalIncome === 0 && sum.totalExpenses === 0 && Object.keys(sum.transfersOut).length === 0) continue;

      accountNodes.push({ id: `acc_${acc.id}`, label: acc.name, color: acc.color, total: sum.totalIncome });

      for (const cat of Object.values(sum.incomeByCategory)) {
        const key = cat.name;
        incomeCats.set(key, { color: cat.color, total: (incomeCats.get(key)?.total ?? 0) + cat.total });
      }
      for (const cat of Object.values(sum.expenseByCategory)) {
        const key = cat.name;
        expenseCats.set(key, { color: cat.color, total: (expenseCats.get(key)?.total ?? 0) + cat.total });
      }
      for (const [toAccId, amount] of Object.entries(sum.transfersOut)) {
        transferLinks.push({ from: acc.id, to: parseInt(toAccId), amount });
      }
    }

    if (accountNodes.length === 0) return;

    // Build node list:
    // [income categories] → [account nodes] → [expense categories]
    type NodeDef = { id: string; label: string; color: string; nodeType: "income" | "account" | "expense" };
    const nodeList: NodeDef[] = [
      ...Array.from(incomeCats.entries()).map(([name, v]) => ({ id: `inc_${name}`, label: name, color: v.color, nodeType: "income" as const })),
      ...accountNodes.map(a => ({ id: a.id, label: a.label, color: a.color, nodeType: "account" as const })),
      ...Array.from(expenseCats.entries()).map(([name, v]) => ({ id: `exp_${name}`, label: name, color: v.color, nodeType: "expense" as const })),
    ];

    const idxMap = new Map(nodeList.map((n, i) => [n.id, i]));

    // Build links
    type LinkDef = { source: number; target: number; value: number; _color: string };
    const linkList: LinkDef[] = [];

    for (const acc of accounts) {
      const sum = accountSummaries[acc.id];
      if (!sum) continue;
      const accIdx = idxMap.get(`acc_${acc.id}`);
      if (accIdx === undefined) continue;

      // Income cats → account
      for (const cat of Object.values(sum.incomeByCategory)) {
        const srcIdx = idxMap.get(`inc_${cat.name}`);
        if (srcIdx === undefined || cat.total <= 0) continue;
        linkList.push({ source: srcIdx, target: accIdx, value: cat.total, _color: cat.color });
      }
      // Account → expense cats
      for (const cat of Object.values(sum.expenseByCategory)) {
        const tgtIdx = idxMap.get(`exp_${cat.name}`);
        if (tgtIdx === undefined || cat.total <= 0) continue;
        linkList.push({ source: accIdx, target: tgtIdx, value: cat.total, _color: cat.color });
      }
    }

    // Transfers between accounts
    for (const t of transferLinks) {
      const srcIdx = idxMap.get(`acc_${t.from}`);
      const tgtIdx = idxMap.get(`acc_${t.to}`);
      if (srcIdx !== undefined && tgtIdx !== undefined) {
        linkList.push({ source: srcIdx, target: tgtIdx, value: t.amount, _color: "#4f98a3" });
      }
    }

    if (linkList.length === 0) return;

    const width = containerRef.current.clientWidth || 900;
    const rowCount = Math.max(incomeCats.size, accountNodes.length, expenseCats.size);
    const height = Math.max(520, rowCount * 56 + 60);
    const margin = { top: 24, right: 170, bottom: 24, left: 170 };

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const sankeyLayout = d3Sankey<NodeDef, LinkDef>()
      .nodeId((_d, i) => i)
      .nodeAlign(sankeyLeft)
      .nodeWidth(16)
      .nodePadding(12)
      .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]]);

    const graph = sankeyLayout({
      nodes: nodeList.map((n, i) => ({ ...n, index: i })),
      links: linkList,
    });

    const g = svg.append("g");

    // Links
    g.append("g").selectAll("path")
      .data(graph.links)
      .join("path")
      .attr("class", "sankey-link")
      .attr("d", sankeyLinkHorizontal() as any)
      .attr("stroke", (d: any) => d._color || "#4f98a3")
      .attr("stroke-width", (d: any) => Math.max(1, d.width))
      .attr("opacity", isDark ? 0.32 : 0.42)
      .on("mouseenter", function() { d3.select(this).attr("opacity", 0.68); })
      .on("mouseleave", function() { d3.select(this).attr("opacity", isDark ? 0.32 : 0.42); });

    // Nodes
    const nodeGs = g.append("g").selectAll("g")
      .data(graph.nodes)
      .join("g");

    nodeGs.append("rect")
      .attr("x", (d: any) => d.x0)
      .attr("y", (d: any) => d.y0)
      .attr("width", (d: any) => d.x1 - d.x0)
      .attr("height", (d: any) => Math.max(2, d.y1 - d.y0))
      .attr("fill", (d: any) => d.color || "#01696f")
      .attr("rx", 3)
      .attr("opacity", isDark ? 0.9 : 0.82);

    // Account nodes: slightly wider + label centered inside
    nodeGs.filter((d: any) => d.nodeType === "account")
      .append("text")
      .attr("x", (d: any) => (d.x0 + d.x1) / 2)
      .attr("y", (d: any) => (d.y0 + d.y1) / 2 - 6)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("font-size", 11)
      .attr("font-family", "DM Sans, sans-serif")
      .attr("font-weight", "600")
      .attr("fill", colors.accountLabel)
      .text((d: any) => d.label);

    nodeGs.filter((d: any) => d.nodeType === "account")
      .append("text")
      .attr("x", (d: any) => (d.x0 + d.x1) / 2)
      .attr("y", (d: any) => (d.y0 + d.y1) / 2 + 8)
      .attr("text-anchor", "middle")
      .attr("font-size", 10)
      .attr("font-family", "DM Mono, monospace")
      .attr("fill", colors.accountVal)
      .text((d: any) => {
        const sum = Object.values(accountSummaries).find(s => s.account.color === d.color && s.account.name === d.label);
        if (!sum) return "";
        return fmt(sum.totalIncome);
      });

    // Income labels (left)
    nodeGs.filter((d: any) => d.nodeType === "income")
      .append("text")
      .attr("x", (d: any) => d.x0 - 10)
      .attr("y", (d: any) => (d.y0 + d.y1) / 2 - 7)
      .attr("text-anchor", "end")
      .attr("font-size", 12)
      .attr("font-family", "DM Sans, sans-serif")
      .attr("fill", colors.label)
      .text((d: any) => d.label);

    nodeGs.filter((d: any) => d.nodeType === "income")
      .append("text")
      .attr("x", (d: any) => d.x0 - 10)
      .attr("y", (d: any) => (d.y0 + d.y1) / 2 + 7)
      .attr("text-anchor", "end")
      .attr("font-size", 11)
      .attr("font-family", "DM Mono, monospace")
      .attr("fill", colors.incomeVal)
      .text((d: any) => fmt(incomeCats.get(d.label)?.total ?? 0));

    // Expense labels (right)
    nodeGs.filter((d: any) => d.nodeType === "expense")
      .append("text")
      .attr("x", (d: any) => d.x1 + 10)
      .attr("y", (d: any) => (d.y0 + d.y1) / 2 - 7)
      .attr("text-anchor", "start")
      .attr("font-size", 12)
      .attr("font-family", "DM Sans, sans-serif")
      .attr("fill", colors.label)
      .text((d: any) => d.label);

    nodeGs.filter((d: any) => d.nodeType === "expense")
      .append("text")
      .attr("x", (d: any) => d.x1 + 10)
      .attr("y", (d: any) => (d.y0 + d.y1) / 2 + 7)
      .attr("text-anchor", "start")
      .attr("font-size", 11)
      .attr("font-family", "DM Mono, monospace")
      .attr("fill", colors.expenseVal)
      .text((d: any) => fmt(expenseCats.get(d.label)?.total ?? 0));

  }, [accountSummaries, accounts, theme]);

  const hasData = accounts.some(a => {
    const s = accountSummaries[a.id];
    return s && (s.totalIncome > 0 || s.totalExpenses > 0);
  });

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <svg viewBox="0 0 48 48" width="40" height="40" fill="none" className="opacity-30">
          <path d="M8 16h10v16H8zm14-6h8v28h-8zm12 10h8v16h-8z" fill="currentColor" />
        </svg>
        <p className="text-sm">Keine Buchungen für diesen Monat</p>
        <p className="text-xs opacity-70">Buchungen manuell hinzufügen oder PDF importieren</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}
