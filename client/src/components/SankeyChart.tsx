import { useEffect, useRef, type MutableRefObject } from "react";
import * as d3 from "d3";
import { sankey as d3Sankey, sankeyLinkHorizontal, sankeyLeft } from "d3-sankey";
import { useTheme } from "@/context/ThemeContext";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import type { Account } from "@shared/schema";
import { safeCssColor } from "@/lib/config";

// === Constants ===
const ROW_HEIGHT_PX = 80;
const ROW_MARGIN_PX = 80;
const MIN_NODE_HEIGHT_PX = 2;
const MIN_CHART_WIDTH = 900;
const CHART_MARGIN = { top: 24, right: 170, bottom: 24, left: 170 } as const;

// === Domain types ===
type NodeType = "income" | "account" | "expense";

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

// === D3 graph types ===
interface NodeDef {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly nodeType: NodeType;
}

interface LinkDef {
  source: number;
  target: number;
  value: number;
  readonly _color: string;
}

interface D3LayoutNode extends NodeDef {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

interface D3LayoutLink {
  readonly source: D3LayoutNode;
  readonly target: D3LayoutNode;
  readonly value: number;
  readonly _color: string;
  readonly width: number;
}

interface ChartColors {
  readonly label: string;
  readonly incomeVal: string;
  readonly expenseVal: string;
  readonly accountLabel: string;
  readonly accountVal: string;
}

type SvgGroup = d3.Selection<SVGGElement, unknown, null, undefined>;
type NodeGroup = d3.Selection<SVGGElement, D3LayoutNode, SVGGElement, unknown>;

// === Intermediate data types ===
interface RawChartData {
  readonly incomeCats: Map<string, { color: string; total: number }>;
  readonly expenseCats: Map<string, { color: string; total: number }>;
  readonly accountNodes: ReadonlyArray<{ id: string; label: string; color: string }>;
  readonly transferLinks: ReadonlyArray<{ from: number; to: number; amount: number }>;
}

interface BuildLinkListOptions {
  readonly accounts: ReadonlyArray<Account>;
  readonly accountSummaries: Record<number, AccountSummary>;
  readonly idxMap: Map<string, number>;
  readonly transferLinks: RawChartData["transferLinks"];
}

// === Formatting ===
function fmt(v: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
}

// === Data collection ===
function aggregateCategoryMap(
  categories: Record<number, CategoryBucket>,
  targetMap: Map<string, { color: string; total: number }>
): void {
  for (const cat of Object.values(categories)) {
    const existing = targetMap.get(cat.name);
    targetMap.set(cat.name, { color: cat.color, total: (existing?.total ?? 0) + cat.total });
  }
}

function collectChartData(
  accounts: ReadonlyArray<Account>,
  accountSummaries: Record<number, AccountSummary>
): RawChartData {
  const incomeCats = new Map<string, { color: string; total: number }>();
  const expenseCats = new Map<string, { color: string; total: number }>();
  const accountNodes: Array<{ id: string; label: string; color: string }> = [];
  const transferLinks: Array<{ from: number; to: number; amount: number }> = [];

  for (const acc of accounts) {
    const sum = accountSummaries[acc.id];
    if (!sum) continue;
    if (sum.totalIncome === 0 && sum.totalExpenses === 0 && Object.keys(sum.transfersOut).length === 0) continue;
    accountNodes.push({ id: `acc_${acc.id}`, label: acc.name, color: acc.color });
    aggregateCategoryMap(sum.incomeByCategory, incomeCats);
    aggregateCategoryMap(sum.expenseByCategory, expenseCats);
    for (const [toAccId, amount] of Object.entries(sum.transfersOut)) {
      transferLinks.push({ from: acc.id, to: parseInt(toAccId), amount });
    }
  }
  return { incomeCats, expenseCats, accountNodes, transferLinks };
}

// === Graph building ===
function buildNodeList(data: RawChartData): NodeDef[] {
  return [
    ...Array.from(data.incomeCats.entries()).map(([name, v]) => ({
      id: `inc_${name}`, label: name, color: v.color, nodeType: "income" as const,
    })),
    ...data.accountNodes.map(a => ({ id: a.id, label: a.label, color: a.color, nodeType: "account" as const })),
    ...Array.from(data.expenseCats.entries()).map(([name, v]) => ({
      id: `exp_${name}`, label: name, color: v.color, nodeType: "expense" as const,
    })),
  ];
}

function buildCategoryLinks(
  sum: AccountSummary,
  accIdx: number,
  idxMap: Map<string, number>
): LinkDef[] {
  const links: LinkDef[] = [];
  for (const cat of Object.values(sum.incomeByCategory)) {
    const srcIdx = idxMap.get(`inc_${cat.name}`);
    if (srcIdx !== undefined && cat.total > 0) links.push({ source: srcIdx, target: accIdx, value: cat.total, _color: cat.color });
  }
  for (const cat of Object.values(sum.expenseByCategory)) {
    const tgtIdx = idxMap.get(`exp_${cat.name}`);
    if (tgtIdx !== undefined && cat.total > 0) links.push({ source: accIdx, target: tgtIdx, value: cat.total, _color: cat.color });
  }
  return links;
}

function buildLinkList(options: BuildLinkListOptions): LinkDef[] {
  const { accounts, accountSummaries, idxMap, transferLinks } = options;
  const linkList: LinkDef[] = [];
  for (const acc of accounts) {
    const sum = accountSummaries[acc.id];
    const accIdx = idxMap.get(`acc_${acc.id}`);
    if (!sum || accIdx === undefined) continue;
    linkList.push(...buildCategoryLinks(sum, accIdx, idxMap));
  }
  for (const t of transferLinks) {
    const srcIdx = idxMap.get(`acc_${t.from}`);
    const tgtIdx = idxMap.get(`acc_${t.to}`);
    if (srcIdx !== undefined && tgtIdx !== undefined) {
      linkList.push({ source: srcIdx, target: tgtIdx, value: t.amount, _color: "#4f98a3" });
    }
  }
  return linkList;
}

// === Layout computation ===
function computeChartDimensions(
  containerWidth: number,
  data: Pick<RawChartData, "incomeCats" | "expenseCats" | "accountNodes">
): { width: number; height: number } {
  const width = Math.max(MIN_CHART_WIDTH, containerWidth || MIN_CHART_WIDTH);
  const rowCount = Math.max(data.incomeCats.size, data.accountNodes.length, data.expenseCats.size);
  const height = Math.max(
    560,
    rowCount * ROW_HEIGHT_PX + ROW_MARGIN_PX,
    data.accountNodes.length * ROW_HEIGHT_PX + ROW_MARGIN_PX,
  );
  return { width, height };
}

function computeSankeyLayout(
  nodeList: NodeDef[],
  linkList: LinkDef[],
  dimensions: { width: number; height: number }
): { nodes: D3LayoutNode[]; links: D3LayoutLink[] } {
  const { width, height } = dimensions;
  const layout = d3Sankey<NodeDef, LinkDef>()
    .nodeAlign(sankeyLeft)
    .nodeWidth(16)
    .nodePadding(16)
    .extent([[CHART_MARGIN.left, CHART_MARGIN.top], [width - CHART_MARGIN.right, height - CHART_MARGIN.bottom]]);
  // d3-sankey setzt node.index = i selbst und nutzt es als Default-ID — kein manuelles nodeId() nötig
  const graph = layout({ nodes: nodeList.map(n => ({ ...n })), links: linkList.map(l => ({ ...l })) });
  return {
    nodes: graph.nodes as unknown as D3LayoutNode[],
    links: graph.links as unknown as D3LayoutLink[],
  };
}

// === Rendering ===
function renderLinks(g: SvgGroup, links: readonly D3LayoutLink[], isDark: boolean): void {
  const linkPath = sankeyLinkHorizontal() as unknown as (d: D3LayoutLink) => string | null;
  const defaultOpacity = isDark ? 0.32 : 0.42;
  g.append("g").selectAll("path")
    .data(links)
    .join("path")
    .attr("class", "sankey-link")
    .attr("d", linkPath)
    .attr("stroke", (d) => d._color || "#4f98a3")
    .attr("stroke-width", (d) => Math.max(1, d.width))
    .attr("opacity", defaultOpacity)
    .on("mouseenter", function() { d3.select(this).attr("opacity", 0.68); })
    .on("mouseleave", function() { d3.select(this).attr("opacity", defaultOpacity); });
}

function renderNodeRects(nodeGs: NodeGroup, isDark: boolean): void {
  nodeGs.append("rect")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("width", (d) => d.x1 - d.x0)
    .attr("height", (d) => Math.max(MIN_NODE_HEIGHT_PX, d.y1 - d.y0))
    .attr("fill", (d) => safeCssColor(d.color))
    .attr("rx", 3)
    .attr("opacity", isDark ? 0.9 : 0.82);
}

function appendAccountNameLabel(nodeGs: NodeGroup, colors: ChartColors): void {
  nodeGs.filter((d) => d.nodeType === "account")
    .append("text")
    .attr("x", (d) => (d.x0 + d.x1) / 2)
    .attr("y", (d) => (d.y0 + d.y1) / 2 - 6)
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle")
    .attr("font-size", 11)
    .attr("font-family", "DM Sans, sans-serif")
    .attr("font-weight", "600")
    .attr("fill", colors.accountLabel)
    .text((d) => d.label);
}

function appendAccountValueLabel(
  nodeGs: NodeGroup,
  accountSummaries: Record<number, AccountSummary>,
  colors: ChartColors
): void {
  nodeGs.filter((d) => d.nodeType === "account")
    .append("text")
    .attr("x", (d) => (d.x0 + d.x1) / 2)
    .attr("y", (d) => (d.y0 + d.y1) / 2 + 8)
    .attr("text-anchor", "middle")
    .attr("font-size", 10)
    .attr("font-family", "DM Mono, monospace")
    .attr("fill", colors.accountVal)
    .text((d) => {
      const sum = Object.values(accountSummaries).find(s => s.account.color === d.color && s.account.name === d.label);
      return sum ? fmt(sum.totalIncome) : "";
    });
}

function renderIncomeLabels(
  nodeGs: NodeGroup,
  incomeCats: Map<string, { color: string; total: number }>,
  colors: ChartColors
): void {
  const incomeGs = nodeGs.filter((d) => d.nodeType === "income");
  incomeGs.append("text")
    .attr("x", (d) => d.x0 - 10)
    .attr("y", (d) => (d.y0 + d.y1) / 2 - 7)
    .attr("text-anchor", "end")
    .attr("font-size", 12)
    .attr("font-family", "DM Sans, sans-serif")
    .attr("fill", colors.label)
    .text((d) => d.label);
  incomeGs.append("text")
    .attr("x", (d) => d.x0 - 10)
    .attr("y", (d) => (d.y0 + d.y1) / 2 + 7)
    .attr("text-anchor", "end")
    .attr("font-size", 11)
    .attr("font-family", "DM Mono, monospace")
    .attr("fill", colors.incomeVal)
    .text((d) => fmt(incomeCats.get(d.label)?.total ?? 0));
}

function renderExpenseLabels(
  nodeGs: NodeGroup,
  expenseCats: Map<string, { color: string; total: number }>,
  colors: ChartColors
): void {
  const expenseGs = nodeGs.filter((d) => d.nodeType === "expense");
  expenseGs.append("text")
    .attr("x", (d) => d.x1 + 10)
    .attr("y", (d) => (d.y0 + d.y1) / 2 - 7)
    .attr("text-anchor", "start")
    .attr("font-size", 12)
    .attr("font-family", "DM Sans, sans-serif")
    .attr("fill", colors.label)
    .text((d) => d.label);
  expenseGs.append("text")
    .attr("x", (d) => d.x1 + 10)
    .attr("y", (d) => (d.y0 + d.y1) / 2 + 7)
    .attr("text-anchor", "start")
    .attr("font-size", 11)
    .attr("font-family", "DM Mono, monospace")
    .attr("fill", colors.expenseVal)
    .text((d) => fmt(expenseCats.get(d.label)?.total ?? 0));
}

function setupZoom(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  g: SvgGroup,
  zoomRef: MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | undefined>
): void {
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.3, 3])
    .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
      g.attr("transform", event.transform.toString());
    });
  svg.call(zoom);
  svg.on("dblclick.zoom", null);
  zoomRef.current = zoom;
}

// === Component ===
export default function SankeyChart({ accountSummaries, accounts }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const colors: ChartColors = {
    label:        isDark ? "#c9c8c6" : "#374151",
    incomeVal:    isDark ? "#6daa45" : "#15803d",
    expenseVal:   isDark ? "#f87171" : "#dc2626",
    accountLabel: isDark ? "#e2e1df" : "#111827",
    accountVal:   isDark ? "#797876" : "#6b7280",
  };

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    if (accounts.length === 0) return;

    const chartData = collectChartData(accounts, accountSummaries);
    const { incomeCats, expenseCats, accountNodes, transferLinks } = chartData;
    if (accountNodes.length === 0) return;

    const nodeList = buildNodeList(chartData);
    const idxMap = new Map(nodeList.map((n, i) => [n.id, i]));
    const linkList = buildLinkList({ accounts, accountSummaries, idxMap, transferLinks });
    if (linkList.length === 0) return;

    const dimensions = computeChartDimensions(containerRef.current.clientWidth, chartData);
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", dimensions.width).attr("height", dimensions.height);

    const { nodes: layoutNodes, links: layoutLinks } = computeSankeyLayout(nodeList, linkList, dimensions);
    const g = svg.append("g");

    renderLinks(g, layoutLinks, isDark);
    const nodeGs = g.append("g").selectAll<SVGGElement, D3LayoutNode>("g").data(layoutNodes).join("g");
    renderNodeRects(nodeGs, isDark);
    appendAccountNameLabel(nodeGs, colors);
    appendAccountValueLabel(nodeGs, accountSummaries, colors);
    renderIncomeLabels(nodeGs, incomeCats, colors);
    renderExpenseLabels(nodeGs, expenseCats, colors);
    setupZoom(svg, g, zoomRef);
  }, [accountSummaries, accounts, theme]);

  function zoomBy(factor: number): void {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, factor);
  }

  function zoomReset(): void {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
  }

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
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => zoomBy(1.4)}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Vergrößern"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={() => zoomBy(1 / 1.4)}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Verkleinern"
        >
          <ZoomOut size={14} />
        </button>
        <button
          onClick={zoomReset}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Zoom zurücksetzen"
        >
          <RotateCcw size={14} />
        </button>
      </div>
      <div ref={containerRef} className="w-full overflow-x-auto overflow-y-hidden">
        <svg ref={svgRef} style={{ display: "block", cursor: "grab" }} />
      </div>
    </div>
  );
}
