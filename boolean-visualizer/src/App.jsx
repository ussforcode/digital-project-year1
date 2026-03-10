import { useEffect, useMemo, useRef, useState } from "react";

const GATE_INFO = {
  INPUT: { inputs: 0, label: "INPUT" },
  OUTPUT: { inputs: 1, label: "OUTPUT" },
  AND: { inputs: 2, label: "AND" },
  OR: { inputs: 2, label: "OR" },
  NOT: { inputs: 1, label: "NOT" },
  NAND: { inputs: 2, label: "NAND" },
  NOR: { inputs: 2, label: "NOR" },
  XOR: { inputs: 2, label: "XOR" },
};

const GATE_TYPES = ["AND", "OR", "NOT", "NAND", "NOR", "XOR"];
const WORKSPACE_WIDTH = 1400;
const WORKSPACE_HEIGHT = 900;

function makeId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function getInitialNodes() {
  return [
    { id: "A", type: "INPUT", label: "A", x: 140, y: 180, value: false },
    { id: "B", type: "INPUT", label: "B", x: 140, y: 360, value: false },
    { id: "G1", type: "AND", label: "AND1", x: 560, y: 270, inputCount: 2 },
    { id: "OUT1", type: "OUTPUT", label: "OUT1", x: 1160, y: 270 },
  ];
}

function getInitialConnections() {
  return [
    { id: "c1", from: "A", to: "G1", inputIndex: 0 },
    { id: "c2", from: "B", to: "G1", inputIndex: 1 },
    { id: "c3", from: "G1", to: "OUT1", inputIndex: 0 },
  ];
}

function getInputCount(node) {
  if (!node) return 0;
  if (["AND", "OR", "NAND", "NOR", "XOR"].includes(node.type)) {
    return Math.max(2, Math.min(8, node.inputCount || 2));
  }
  return GATE_INFO[node.type]?.inputs || 0;
}

function getNodeSize(node) {
  if (node.type === "INPUT" || node.type === "OUTPUT") {
    return { width: 94, height: 84 };
  }
  if (node.type === "NOT") {
    return { width: 110, height: 82 };
  }
  const count = getInputCount(node);
  return {
    width: 126,
    height: Math.max(92, 70 + count * 16),
  };
}

function evaluateGate(type, inputs) {
  const normalized = inputs.map(Boolean);
  switch (type) {
    case "INPUT":
      return !!normalized[0];
    case "OUTPUT":
      return !!normalized[0];
    case "AND":
      return normalized.every(Boolean);
    case "OR":
      return normalized.some(Boolean);
    case "NOT":
      return !normalized[0];
    case "NAND":
      return !normalized.every(Boolean);
    case "NOR":
      return !normalized.some(Boolean);
    case "XOR":
      return normalized.filter(Boolean).length % 2 === 1;
    default:
      return false;
  }
}

function computeOutputs(nodes, connections) {
  const nodeMap = {};
  const incoming = {};

  nodes.forEach((node) => {
    nodeMap[node.id] = node;
    incoming[node.id] = [];
  });

  connections.forEach((conn) => {
    if (incoming[conn.to]) incoming[conn.to].push(conn);
  });

  const memo = {};
  const visiting = new Set();

  function getValue(nodeId) {
    if (memo[nodeId] !== undefined) return memo[nodeId];
    if (visiting.has(nodeId)) return false;

    visiting.add(nodeId);
    const node = nodeMap[nodeId];
    if (!node) {
      visiting.delete(nodeId);
      return false;
    }

    let result = false;

    if (node.type === "INPUT") {
      result = !!node.value;
    } else {
      const inputCount = getInputCount(node);
      const inputValues = new Array(inputCount).fill(false);

      (incoming[nodeId] || []).forEach((conn) => {
        if (conn.inputIndex >= 0 && conn.inputIndex < inputCount) {
          inputValues[conn.inputIndex] = getValue(conn.from);
        }
      });

      result = evaluateGate(node.type, inputValues);
    }

    memo[nodeId] = result;
    visiting.delete(nodeId);
    return result;
  }

  const outputs = {};
  nodes.forEach((node) => {
    outputs[node.id] = getValue(node.id);
  });
  return outputs;
}

function generateTruthTable(nodes, connections) {
  const inputNodes = nodes.filter((n) => n.type === "INPUT");
  const outputNodes = nodes.filter((n) => n.type === "OUTPUT");
  const rows = [];
  const totalRows = Math.pow(2, inputNodes.length);

  for (let i = 0; i < totalRows; i += 1) {
    const testNodes = nodes.map((n) => ({ ...n }));

    inputNodes.forEach((inputNode, index) => {
      const bit = (i >> (inputNodes.length - index - 1)) & 1;
      const target = testNodes.find((n) => n.id === inputNode.id);
      if (target) target.value = !!bit;
    });

    const values = computeOutputs(testNodes, connections);

    rows.push({
      inputs: inputNodes.map((n) => ({ label: n.label, value: values[n.id] ? 1 : 0 })),
      outputs: outputNodes.map((n) => ({ label: n.label, value: values[n.id] ? 1 : 0 })),
    });
  }

  return rows;
}

function getExpressionForNode(nodeId, nodes, connections, visited = new Set()) {
  if (visited.has(nodeId)) return "LOOP";
  visited.add(nodeId);

  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return "?";
  if (node.type === "INPUT") return node.label;

  const inputCount = getInputCount(node);
  const incoming = connections.filter((c) => c.to === nodeId).sort((a, b) => a.inputIndex - b.inputIndex);
  const args = new Array(inputCount).fill("0");

  incoming.forEach((conn) => {
    args[conn.inputIndex] = getExpressionForNode(conn.from, nodes, connections, new Set(visited));
  });

  switch (node.type) {
    case "OUTPUT":
      return args[0];
    case "NOT":
      return `NOT(${args[0]})`;
    case "AND":
      return `(${args.join(" AND ")})`;
    case "OR":
      return `(${args.join(" OR ")})`;
    case "NAND":
      return `NOT(${args.join(" AND ")})`;
    case "NOR":
      return `NOT(${args.join(" OR ")})`;
    case "XOR":
      return `(${args.join(" XOR ")})`;
    default:
      return "?";
  }
}

function getInputOffsetY(node, inputIndex) {
  const inputCount = getInputCount(node);
  if (inputCount <= 1) return 0;
  const { height } = getNodeSize(node);
  const top = -height / 2 + 18;
  const bottom = height / 2 - 18;
  const step = (bottom - top) / (inputCount - 1);
  return top + step * inputIndex;
}

function getPortPosition(node, side, inputIndex = 0) {
  const { width } = getNodeSize(node);

  if (side === "out") {
    return { x: node.x + width / 2 + 12, y: node.y };
  }

  return {
    x: node.x - width / 2 - 12,
    y: node.y + getInputOffsetY(node, inputIndex),
  };
}

function findNearestInputPort(nodes, x, y) {
  let nearest = null;
  let bestDistance = Infinity;

  nodes.forEach((node) => {
    if (node.type === "INPUT") return;
    const count = getInputCount(node);
    for (let i = 0; i < count; i += 1) {
      const p = getPortPosition(node, "in", i);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDistance) {
        bestDistance = d;
        nearest = { nodeId: node.id, inputIndex: i, x: p.x, y: p.y };
      }
    }
  });

  if (bestDistance <= 26) return nearest;
  return null;
}

function GateChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: "12px",
        border: active ? "1px solid #0f172a" : "1px solid #d7deea",
        background: active ? "#0f172a" : "#ffffff",
        color: active ? "#ffffff" : "#111827",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: "600",
        transition: "0.2s",
        flex: "1 1 auto",
      }}
    >
      {label}
    </button>
  );
}

function GateShape({ node, value, selected, onMouseDown, onSelect, onToggleInput, onStartWire }) {
  const { width, height } = getNodeSize(node);
  const isInput = node.type === "INPUT";
  const isOutput = node.type === "OUTPUT";
  const count = getInputCount(node);
  const stroke = selected ? "#0f172a" : "#cbd5e1";
  const fill = selected ? "rgba(219,234,254,0.96)" : "rgba(255,255,255,0.97)";

  const body = (() => {
    if (node.type === "INPUT" || node.type === "OUTPUT") {
      return (
        <rect
          x={-width / 2}
          y={-height / 2}
          rx="24"
          ry="24"
          width={width}
          height={height}
          fill={fill}
          stroke={stroke}
          strokeWidth={selected ? 2.6 : 1.8}
        />
      );
    }

    if (node.type === "NOT") {
      const left = -width / 2 + 10;
      const right = width / 2 - 18;
      const top = -height / 2 + 10;
      const bottom = height / 2 - 10;
      return (
        <g>
          <path d={`M ${left} ${top} L ${left} ${bottom} L ${right} 0 Z`} fill={fill} stroke={stroke} strokeWidth={selected ? 2.6 : 1.8} />
          <circle cx={right + 10} cy="0" r="8" fill={fill} stroke={stroke} strokeWidth={selected ? 2.6 : 1.8} />
        </g>
      );
    }

    if (node.type === "AND" || node.type === "NAND") {
      const left = -width / 2 + 12;
      const top = -height / 2 + 10;
      const bottom = height / 2 - 10;
      const midX = 4;
      return (
        <g>
          <path
            d={`M ${left} ${top} L ${midX} ${top} A ${height / 2 - 10} ${height / 2 - 10} 0 0 1 ${midX} ${bottom} L ${left} ${bottom} Z`}
            fill={fill}
            stroke={stroke}
            strokeWidth={selected ? 2.6 : 1.8}
          />
          {node.type === "NAND" && <circle cx={width / 2 - 4} cy="0" r="8" fill={fill} stroke={stroke} strokeWidth={selected ? 2.6 : 1.8} />}
        </g>
      );
    }

    const bubble = node.type === "NOR" ? 8 : 0;
    return (
      <g>
        <path
          d={`M ${-width / 2 + 10} ${-height / 2 + 8} C ${-width / 4} ${-height / 2 + 8}, ${width / 6} ${-height / 4}, ${width / 2 - 16 - bubble} 0 C ${width / 6} ${height / 4}, ${-width / 4} ${height / 2 - 8}, ${-width / 2 + 10} ${height / 2 - 8} C ${-width / 2 + 22} ${height / 4}, ${-width / 2 + 22} ${-height / 4}, ${-width / 2 + 10} ${-height / 2 + 8} Z`}
          fill={fill}
          stroke={stroke}
          strokeWidth={selected ? 2.6 : 1.8}
        />
        {node.type === "XOR" && (
          <path
            d={`M ${-width / 2 + 2} ${-height / 2 + 8} C ${-width / 2 + 14} ${-height / 4}, ${-width / 2 + 14} ${height / 4}, ${-width / 2 + 2} ${height / 2 - 8}`}
            fill="none"
            stroke={stroke}
            strokeWidth={selected ? 2.2 : 1.5}
          />
        )}
        {node.type === "NOR" && <circle cx={width / 2 - 5} cy="0" r="8" fill={fill} stroke={stroke} strokeWidth={selected ? 2.6 : 1.8} />}
      </g>
    );
  })();

  return (
    <g transform={`translate(${node.x}, ${node.y})`}>
      <g onMouseDown={onMouseDown} onClick={onSelect} style={{ cursor: "grab" }}>
        {body}
      </g>

      <text x="0" y="-10" textAnchor="middle" fontSize="15" fontWeight="700" fill="#0f172a">
        {node.label}
      </text>
      <text x="0" y="12" textAnchor="middle" fontSize="12" fill="#475569">
        {GATE_INFO[node.type].label}
      </text>
      <text x="0" y="32" textAnchor="middle" fontSize="13" fontWeight="700" fill={value ? "#16a34a" : "#64748b"}>
        {value ? "1" : "0"}
      </text>

      {isInput && (
        <g>
          <circle
            cx="0"
            cy={height / 2 + 24}
            r="18"
            fill={value ? "#0f172a" : "#ffffff"}
            stroke="#0f172a"
            strokeWidth="2"
            style={{ cursor: "pointer" }}
            onClick={onToggleInput}
          />
          <text
            x="0"
            y={height / 2 + 29}
            textAnchor="middle"
            fontSize="13"
            fontWeight="700"
            fill={value ? "#ffffff" : "#0f172a"}
            style={{ cursor: "pointer", userSelect: "none" }}
            onClick={onToggleInput}
          >
            {value ? "1" : "0"}
          </text>
        </g>
      )}

      {!isOutput && (
        <circle
          cx={width / 2 + 12}
          cy="0"
          r="12"
          fill="#ffffff"
          stroke="#0f172a"
          strokeWidth="2"
          style={{ cursor: "crosshair" }}
          onMouseDown={onStartWire}
        />
      )}

      {!isInput &&
        Array.from({ length: count }).map((_, index) => {
          const cy = getInputOffsetY(node, index);
          return <circle key={index} cx={-width / 2 - 12} cy={cy} r="7" fill="#ffffff" stroke="#0f172a" strokeWidth="2" />;
        })}
    </g>
  );
}

function App() {
  const [nodes, setNodes] = useState(getInitialNodes());
  const [connections, setConnections] = useState(getInitialConnections());
  const [selectedNodeId, setSelectedNodeId] = useState("G1");
  const [selectedFrom, setSelectedFrom] = useState("");
  const [selectedTo, setSelectedTo] = useState("");
  const [selectedInputIndex, setSelectedInputIndex] = useState(0);
  const [newGateType, setNewGateType] = useState("OR");
  const [dragState, setDragState] = useState(null);
  const [wireDrag, setWireDrag] = useState(null);
  const [hoverPort, setHoverPort] = useState(null);
  const [copied, setCopied] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);
  const svgRef = useRef(null);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < 980;
  const isSmallMobile = windowWidth < 640;

  const outputs = useMemo(() => computeOutputs(nodes, connections), [nodes, connections]);
  const truthTable = useMemo(() => generateTruthTable(nodes, connections), [nodes, connections]);
  const inputNodes = nodes.filter((n) => n.type === "INPUT");
  const outputNodes = nodes.filter((n) => n.type === "OUTPUT");
  const sourceNodes = nodes.filter((n) => n.type !== "OUTPUT");
  const targetNodes = nodes.filter((n) => n.type !== "INPUT");
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const expressions = outputNodes.map((node) => ({
    label: node.label,
    expr: getExpressionForNode(node.id, nodes, connections),
  }));

  function addGate() {
    const count = nodes.filter((n) => !["INPUT", "OUTPUT"].includes(n.type)).length;
    const type = newGateType;
    const id = makeId("G");
    const label = `${type}${count + 1}`;

    setNodes((prev) => [
      ...prev,
      {
        id,
        type,
        label,
        x: 300 + (count % 3) * 180,
        y: 140 + Math.floor(count / 3) * 140,
        ...(["AND", "OR", "NAND", "NOR", "XOR"].includes(type) ? { inputCount: 2 } : {}),
      },
    ]);
    setSelectedNodeId(id);
  }

  function addInput() {
    const count = nodes.filter((n) => n.type === "INPUT").length;
    const label = String.fromCharCode(65 + count);
    setNodes((prev) => [
      ...prev,
      {
        id: makeId("IN"),
        type: "INPUT",
        label,
        x: 140,
        y: 140 + count * 110,
        value: false,
      },
    ]);
  }

  function addOutput() {
    const count = nodes.filter((n) => n.type === "OUTPUT").length;
    setNodes((prev) => [
      ...prev,
      {
        id: makeId("OUT"),
        type: "OUTPUT",
        label: `OUT${count + 1}`,
        x: 1160,
        y: 180 + count * 130,
      },
    ]);
  }

  function toggleInput(nodeId) {
    setNodes((prev) => prev.map((node) => (node.id === nodeId ? { ...node, value: !node.value } : node)));
  }

  function updateSelectedGateInputs(delta) {
    if (!selectedNode) return;
    if (!["AND", "OR", "NAND", "NOR", "XOR"].includes(selectedNode.type)) return;

    const nextCount = Math.max(2, Math.min(8, getInputCount(selectedNode) + delta));
    setNodes((prev) => prev.map((node) => (node.id === selectedNode.id ? { ...node, inputCount: nextCount } : node)));
    setConnections((prev) => prev.filter((c) => !(c.to === selectedNode.id && c.inputIndex >= nextCount)));
  }

  function addConnectionManual() {
    if (!selectedFrom || !selectedTo) return;
    if (selectedFrom === selectedTo) return;
    const target = nodes.find((n) => n.id === selectedTo);
    if (!target) return;
    const maxInputs = getInputCount(target);
    if (selectedInputIndex < 0 || selectedInputIndex >= maxInputs) return;

    setConnections((prev) => {
      const filtered = prev.filter((c) => !(c.to === selectedTo && c.inputIndex === selectedInputIndex));
      return [...filtered, { id: makeId("C"), from: selectedFrom, to: selectedTo, inputIndex: selectedInputIndex }];
    });
  }

  function removeConnection(connectionId) {
    setConnections((prev) => prev.filter((c) => c.id !== connectionId));
  }

  function deleteSelectedNode() {
    if (!selectedNode) return;
    if (["A", "B", "OUT1"].includes(selectedNode.id)) return;
    setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
    setConnections((prev) => prev.filter((c) => c.from !== selectedNode.id && c.to !== selectedNode.id));
    setSelectedNodeId("");
  }

  function clearConnections() {
    setConnections([]);
  }

  function resetProject() {
    setNodes(getInitialNodes());
    setConnections(getInitialConnections());
    setSelectedNodeId("G1");
    setSelectedFrom("");
    setSelectedTo("");
    setSelectedInputIndex(0);
    setWireDrag(null);
    setHoverPort(null);
  }

  function svgPoint(event) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * WORKSPACE_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * WORKSPACE_HEIGHT,
    };
  }

  function handleStartWire(event, nodeId) {
    event.preventDefault();
    event.stopPropagation();

    const point = svgPoint(event);
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || node.type === "OUTPUT") return;

    const outPort = getPortPosition(node, "out");
    setSelectedNodeId(node.id);
    setWireDrag({
      from: node.id,
      startX: outPort.x,
      startY: outPort.y,
      x: point.x,
      y: point.y,
    });
  }

  function handleMouseDown(event, nodeId) {
    event.preventDefault();
    event.stopPropagation();

    const point = svgPoint(event);
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setSelectedNodeId(node.id);
    setDragState({ nodeId, offsetX: point.x - node.x, offsetY: point.y - node.y });
  }

  function handleMouseMove(event) {
    const point = svgPoint(event);

    if (wireDrag) {
      setWireDrag((prev) => (prev ? { ...prev, x: point.x, y: point.y } : prev));
      setHoverPort(findNearestInputPort(nodes, point.x, point.y));
      return;
    }

    if (!dragState) return;

    const margin = 70;

    setNodes((prev) =>
      prev.map((node) =>
        node.id === dragState.nodeId
          ? {
              ...node,
              x: Math.max(margin, Math.min(WORKSPACE_WIDTH - margin, point.x - dragState.offsetX)),
              y: Math.max(margin, Math.min(WORKSPACE_HEIGHT - margin, point.y - dragState.offsetY)),
            }
          : node
      )
    );
  }

  function handleMouseUp(event) {
    const point = svgPoint(event);

    if (wireDrag) {
      const nearest = findNearestInputPort(nodes, point.x, point.y);
      if (nearest && nearest.nodeId !== wireDrag.from) {
        setConnections((prev) => {
          const filtered = prev.filter((c) => !(c.to === nearest.nodeId && c.inputIndex === nearest.inputIndex));
          return [...filtered, { id: makeId("C"), from: wireDrag.from, to: nearest.nodeId, inputIndex: nearest.inputIndex }];
        });
      }
      setWireDrag(null);
      setHoverPort(null);
    }

    setDragState(null);
  }

  function copyExpressions() {
    const text = expressions.map((item) => `${item.label} = ${item.expr}`).join("\n");
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  const selectedGateSupportsMultipleInputs =
    selectedNode && ["AND", "OR", "NAND", "NOR", "XOR"].includes(selectedNode.type);

  return (
    <div
      style={{
        minHeight: "100dvh",
        width: "100%",
        background: "radial-gradient(circle at top left, #eff6ff 0%, #f8fafc 35%, #eef2ff 100%)",
        padding: "clamp(12px, 2vw, 28px)",
        fontFamily: "Inter, Arial, Helvetica, sans-serif",
        color: "#0f172a",
        userSelect: "none",
        boxSizing: "border-box",
      }}
    >
      <div style={{ width: "100%", maxWidth: "none", margin: "0 auto" }}>
        <div
          style={{
            background: "rgba(255,255,255,0.78)",
            border: "1px solid rgba(219, 234, 254, 0.9)",
            backdropFilter: "blur(12px)",
            borderRadius: "28px",
            padding: isSmallMobile ? "18px" : "24px 28px",
            boxShadow: "0 16px 40px rgba(15, 23, 42, 0.08)",
            marginBottom: "22px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "16px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "700",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#475569",
                  marginBottom: "6px",
                }}
              >
                Digital Logic Design
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "clamp(26px, 3vw, 34px)",
                  fontWeight: "800",
                  letterSpacing: "-0.03em",
                }}
              >
                Boolean Logic Visualizer
              </h1>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button onClick={clearConnections} style={topButtonStyle}>Clear Connections</button>
              <button onClick={resetProject} style={topButtonDarkStyle}>Reset Project</button>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "minmax(300px, 360px) minmax(0, 1fr)",
            gap: "22px",
            width: "100%",
            alignItems: "start",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              position: isMobile ? "static" : "sticky",
              top: isMobile ? "auto" : "20px",
              alignSelf: "start",
              maxHeight: isMobile ? "none" : "calc(100dvh - 40px)",
              overflowY: isMobile ? "visible" : "auto",
              paddingRight: isMobile ? 0 : "4px",
            }}
          >
            <section style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <h2 style={sectionTitleStyle}>Gates</h2>
                <span style={sectionTagStyle}>{GATE_TYPES.length} Types</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {GATE_TYPES.map((type) => (
                  <GateChip key={type} label={type} active={newGateType === type} onClick={() => setNewGateType(type)} />
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "16px" }}>
                <button onClick={addGate} style={buttonStyle}>Add Gate</button>
                <button onClick={addInput} style={buttonStyle}>Add Input</button>
                <button onClick={addOutput} style={buttonStyle}>Add Output</button>
                <button onClick={deleteSelectedNode} style={buttonDangerSoftStyle}>Remove Selected</button>
              </div>
            </section>

            <section style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <h2 style={sectionTitleStyle}>Connection</h2>
                <span style={sectionTagStyle}>{connections.length} Lines</span>
              </div>
              <label style={labelStyle}>From</label>
              <select value={selectedFrom} onChange={(e) => setSelectedFrom(e.target.value)} style={inputStyle}>
                <option value="">Select source</option>
                {sourceNodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.label} ({node.type})
                  </option>
                ))}
              </select>

              <label style={{ ...labelStyle, marginTop: "14px" }}>To</label>
              <select
                value={selectedTo}
                onChange={(e) => {
                  setSelectedTo(e.target.value);
                  setSelectedInputIndex(0);
                }}
                style={inputStyle}
              >
                <option value="">Select target</option>
                {targetNodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.label} ({node.type})
                  </option>
                ))}
              </select>

              <label style={{ ...labelStyle, marginTop: "14px" }}>Port</label>
              <input
                type="number"
                min="0"
                max="7"
                value={selectedInputIndex}
                onChange={(e) => setSelectedInputIndex(Number(e.target.value || 0))}
                style={inputStyle}
              />

              <button onClick={addConnectionManual} style={{ ...buttonStyle, width: "100%", marginTop: "16px" }}>
                Connect
              </button>
            </section>

            <section style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <h2 style={sectionTitleStyle}>Inspector</h2>
                <span style={sectionTagStyle}>{selectedNode ? selectedNode.type : "None"}</span>
              </div>
              {selectedNode ? (
                <>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <span style={badgeStyle}>{selectedNode.label}</span>
                    <span style={badgeStyle}>Output {outputs[selectedNode.id] ? "1" : "0"}</span>
                    {selectedGateSupportsMultipleInputs && <span style={badgeStyle}>{getInputCount(selectedNode)} Inputs</span>}
                  </div>

                  <div style={{ marginTop: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div style={infoCardStyle}>
                      <div style={infoLabelStyle}>X</div>
                      <div style={infoValueStyle}>{Math.round(selectedNode.x)}</div>
                    </div>
                    <div style={infoCardStyle}>
                      <div style={infoLabelStyle}>Y</div>
                      <div style={infoValueStyle}>{Math.round(selectedNode.y)}</div>
                    </div>
                  </div>

                  {selectedGateSupportsMultipleInputs && (
                    <div style={{ marginTop: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <button onClick={() => updateSelectedGateInputs(-1)} style={buttonStyle}>- Input</button>
                      <button onClick={() => updateSelectedGateInputs(1)} style={buttonStyle}>+ Input</button>
                    </div>
                  )}

                  {selectedNode.type === "INPUT" && (
                    <button onClick={() => toggleInput(selectedNode.id)} style={{ ...buttonStyle, width: "100%", marginTop: "16px" }}>
                      Toggle Input
                    </button>
                  )}
                </>
              ) : (
                <div style={{ color: "#64748b", fontSize: "14px" }}>No node selected</div>
              )}
            </section>

            <section style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <h2 style={sectionTitleStyle}>Expression</h2>
                <button onClick={copyExpressions} style={smallActionStyle}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {expressions.map((item) => (
                  <div key={item.label} style={expressionCardStyle}>
                    <div style={expressionLabelStyle}>{item.label}</div>
                    <div style={expressionValueStyle}>{item.expr}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <h2 style={sectionTitleStyle}>I/O Status</h2>
                <span style={sectionTagStyle}>
                  {inputNodes.length} In / {outputNodes.length} Out
                </span>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <div style={subHeadingStyle}>Inputs</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {inputNodes.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => toggleInput(node.id)}
                      style={{
                        ...toggleChipStyle,
                        background: outputs[node.id] ? "#0f172a" : "#ffffff",
                        color: outputs[node.id] ? "#ffffff" : "#0f172a",
                        border: outputs[node.id] ? "1px solid #0f172a" : "1px solid #d7deea",
                      }}
                    >
                      {node.label} : {outputs[node.id] ? 1 : 0}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={subHeadingStyle}>Outputs</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  {outputNodes.map((node) => (
                    <span
                      key={node.id}
                      style={{
                        ...badgeStyle,
                        background: outputs[node.id] ? "#dcfce7" : "#f1f5f9",
                        border: outputs[node.id] ? "1px solid #86efac" : "1px solid #dbe3ee",
                        color: "#0f172a",
                      }}
                    >
                      {node.label} : {outputs[node.id] ? 1 : 0}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px", minWidth: 0 }}>
            <section style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <h2 style={sectionTitleStyle}>Circuit Workspace</h2>
                <span style={sectionTagStyle}>{nodes.length} Nodes</span>
              </div>

              <div
                style={{
                  borderRadius: "24px",
                  overflow: "hidden",
                  border: "1px solid #dbe3ee",
                  background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
                  height: isMobile ? "65dvh" : "calc(100dvh - 240px)",
                  minHeight: isMobile ? "420px" : "620px",
                }}
              >
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${WORKSPACE_WIDTH} ${WORKSPACE_HEIGHT}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    touchAction: "none",
                    userSelect: "none",
                  }}
                  onDragStart={(e) => e.preventDefault()}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <defs>
                    <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#eef2f7" strokeWidth="1" />
                    </pattern>
                    <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
                      <rect width="100" height="100" fill="url(#smallGrid)" />
                      <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#dfe7f3" strokeWidth="1.2" />
                    </pattern>
                    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#0f172a" />
                    </marker>
                  </defs>

                  <rect x="0" y="0" width={WORKSPACE_WIDTH} height={WORKSPACE_HEIGHT} fill="url(#grid)" />

                  {connections.map((conn) => {
                    const fromNode = nodes.find((n) => n.id === conn.from);
                    const toNode = nodes.find((n) => n.id === conn.to);
                    if (!fromNode || !toNode) return null;
                    const p1 = getPortPosition(fromNode, "out");
                    const p2 = getPortPosition(toNode, "in", conn.inputIndex);
                    const midX = (p1.x + p2.x) / 2;
                    const active = outputs[conn.from];

                    return (
                      <g key={conn.id}>
                        <path
                          d={`M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`}
                          fill="none"
                          stroke={active ? "#0f172a" : "#94a3b8"}
                          strokeWidth="3.2"
                          markerEnd="url(#arrow)"
                        />
                        <circle
                          cx={(p1.x + p2.x) / 2}
                          cy={(p1.y + p2.y) / 2}
                          r="10"
                          fill="#ffffff"
                          stroke="#0f172a"
                          strokeWidth="1.5"
                          onClick={() => removeConnection(conn.id)}
                          style={{ cursor: "pointer" }}
                        />
                        <text
                          x={(p1.x + p2.x) / 2}
                          y={(p1.y + p2.y) / 2 + 4}
                          textAnchor="middle"
                          fontSize="10"
                          fill="#0f172a"
                          style={{ cursor: "pointer", userSelect: "none" }}
                          onClick={() => removeConnection(conn.id)}
                        >
                          ×
                        </text>
                      </g>
                    );
                  })}

                  {wireDrag && (
                    <path
                      d={`M ${wireDrag.startX} ${wireDrag.startY} C ${(wireDrag.startX + wireDrag.x) / 2} ${wireDrag.startY}, ${(wireDrag.startX + wireDrag.x) / 2} ${wireDrag.y}, ${wireDrag.x} ${wireDrag.y}`}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="3"
                      strokeDasharray="8 6"
                    />
                  )}

                  {hoverPort && (
                    <circle cx={hoverPort.x} cy={hoverPort.y} r="11" fill="rgba(37,99,235,0.15)" stroke="#2563eb" strokeWidth="2" />
                  )}

                  {nodes.map((node) => (
                    <GateShape
                      key={node.id}
                      node={node}
                      value={outputs[node.id]}
                      selected={selectedNodeId === node.id}
                      onMouseDown={(e) => handleMouseDown(e, node.id)}
                      onSelect={() => setSelectedNodeId(node.id)}
                      onToggleInput={() => toggleInput(node.id)}
                      onStartWire={(e) => handleStartWire(e, node.id)}
                    />
                  ))}
                </svg>
              </div>
            </section>

            <section style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <h2 style={sectionTitleStyle}>Truth Table</h2>
                <span style={sectionTagStyle}>{truthTable.length} Rows</span>
              </div>

              <div
                style={{
                  overflow: "auto",
                  maxHeight: "420px",
                  borderRadius: "18px",
                  border: "1px solid #dbe3ee",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    background: "#ffffff",
                    fontSize: "14px",
                    minWidth: "420px",
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {inputNodes.map((node) => (
                        <th key={node.id} style={tableHeadStyle}>{node.label}</th>
                      ))}
                      {outputNodes.map((node) => (
                        <th key={node.id} style={tableHeadStyle}>{node.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {truthTable.map((row, rowIndex) => (
                      <tr key={rowIndex} style={{ background: rowIndex % 2 === 0 ? "#ffffff" : "#fbfdff" }}>
                        {row.inputs.map((cell, index) => (
                          <td key={`i-${index}`} style={tableCellStyle}>{cell.value}</td>
                        ))}
                        {row.outputs.map((cell, index) => (
                          <td
                            key={`o-${index}`}
                            style={{
                              ...tableCellStyle,
                              fontWeight: "700",
                              color: cell.value ? "#16a34a" : "#334155",
                            }}
                          >
                            {cell.value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

const panelStyle = {
  background: "rgba(255,255,255,0.86)",
  backdropFilter: "blur(10px)",
  border: "1px solid rgba(219, 234, 254, 0.95)",
  borderRadius: "26px",
  padding: "20px",
  boxShadow: "0 16px 34px rgba(15, 23, 42, 0.06)",
  minWidth: 0,
};

const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "16px",
  flexWrap: "wrap",
};

const sectionTitleStyle = {
  margin: 0,
  fontSize: "20px",
  fontWeight: "800",
  letterSpacing: "-0.02em",
};

const sectionTagStyle = {
  display: "inline-flex",
  alignItems: "center",
  padding: "7px 12px",
  borderRadius: "999px",
  background: "#f8fafc",
  border: "1px solid #dbe3ee",
  fontSize: "12px",
  fontWeight: "700",
  color: "#475569",
};

const topButtonStyle = {
  padding: "11px 16px",
  borderRadius: "14px",
  border: "1px solid #d7deea",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "700",
};

const topButtonDarkStyle = {
  padding: "11px 16px",
  borderRadius: "14px",
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#ffffff",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "700",
};

const buttonStyle = {
  padding: "11px 14px",
  borderRadius: "14px",
  border: "1px solid #d7deea",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "700",
  transition: "0.2s",
};

const buttonDangerSoftStyle = {
  padding: "11px 14px",
  borderRadius: "14px",
  border: "1px solid #fecaca",
  background: "#fff5f5",
  color: "#b91c1c",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: "700",
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid #d7deea",
  boxSizing: "border-box",
  marginTop: "7px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: "14px",
};

const labelStyle = {
  display: "block",
  fontSize: "13px",
  fontWeight: "700",
  color: "#334155",
};

const badgeStyle = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: "999px",
  background: "#f8fafc",
  border: "1px solid #dbe3ee",
  fontSize: "13px",
  fontWeight: "700",
  color: "#0f172a",
};

const infoCardStyle = {
  borderRadius: "18px",
  border: "1px solid #dbe3ee",
  background: "#f8fbff",
  padding: "14px",
};

const infoLabelStyle = {
  fontSize: "12px",
  fontWeight: "700",
  color: "#64748b",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const infoValueStyle = {
  fontSize: "22px",
  fontWeight: "800",
  color: "#0f172a",
};

const subHeadingStyle = {
  fontSize: "13px",
  fontWeight: "700",
  color: "#475569",
  marginBottom: "10px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const toggleChipStyle = {
  padding: "10px 14px",
  borderRadius: "12px",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: "700",
};

const smallActionStyle = {
  padding: "8px 12px",
  borderRadius: "12px",
  border: "1px solid #d7deea",
  background: "#ffffff",
  color: "#0f172a",
  cursor: "pointer",
  fontSize: "12px",
  fontWeight: "700",
};

const expressionCardStyle = {
  borderRadius: "16px",
  border: "1px solid #dbe3ee",
  background: "#fbfdff",
  padding: "14px",
};

const expressionLabelStyle = {
  fontSize: "12px",
  fontWeight: "800",
  color: "#64748b",
  marginBottom: "8px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const expressionValueStyle = {
  fontSize: "14px",
  fontWeight: "700",
  color: "#0f172a",
  lineHeight: 1.5,
  wordBreak: "break-word",
};

const tableHeadStyle = {
  borderBottom: "1px solid #dbe3ee",
  padding: "14px 16px",
  textAlign: "left",
  color: "#334155",
  fontWeight: "800",
  position: "sticky",
  top: 0,
  background: "#f8fafc",
  zIndex: 1,
};

const tableCellStyle = {
  borderBottom: "1px solid #eef2f7",
  padding: "13px 16px",
  color: "#0f172a",
};

export default App;