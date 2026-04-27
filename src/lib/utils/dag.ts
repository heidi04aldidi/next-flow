import type { FlowNode, FlowEdge, NodeType } from "@/types";
import { OUTPUT_HANDLE_TYPES, HANDLE_TYPES, type HandleType } from "@/types";

/**
 * Topological sort (Kahn's algorithm) for DAG execution ordering
 * Returns nodes grouped by execution level (parallel batches)
 */
export function topologicalSort(
  nodes: FlowNode[],
  edges: FlowEdge[]
): FlowNode[][] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // Initialize
  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  // Build graph
  for (const edge of edges) {
    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  // BFS level-by-level (each level = parallel batch)
  const levels: FlowNode[][] = [];
  let currentLevel = nodes.filter((n) => inDegree.get(n.id) === 0);

  while (currentLevel.length > 0) {
    levels.push(currentLevel);
    const nextLevel: FlowNode[] = [];

    for (const node of currentLevel) {
      for (const neighbor of adjacency.get(node.id) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          const neighborNode = nodeMap.get(neighbor);
          if (neighborNode) nextLevel.push(neighborNode);
        }
      }
    }

    currentLevel = nextLevel;
  }

  return levels;
}

/**
 * Check if adding an edge would create a cycle
 */
export function wouldCreateCycle(
  nodes: FlowNode[],
  edges: FlowEdge[],
  newSource: string,
  newTarget: string
): boolean {
  // DFS from newTarget — if we can reach newSource, it's a cycle
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) adjacency.get(edge.source)?.push(edge.target);

  const visited = new Set<string>();
  const stack = [newTarget];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === newSource) return true;
    if (!visited.has(current)) {
      visited.add(current);
      stack.push(...(adjacency.get(current) ?? []));
    }
  }

  return false;
}

/**
 * Get direct upstream dependencies for a node
 */
export function getUpstreamNodes(
  nodeId: string,
  edges: FlowEdge[]
): string[] {
  return edges
    .filter((e) => e.target === nodeId)
    .map((e) => e.source);
}

/**
 * Get edges connecting to a specific target handle
 */
export function getEdgesForHandle(
  nodeId: string,
  handleId: string,
  edges: FlowEdge[]
): FlowEdge[] {
  return edges.filter(
    (e) => e.target === nodeId && e.targetHandle === handleId
  );
}

/**
 * Validate connection type compatibility
 */
export function isValidConnection(
  sourceNodeType: NodeType,
  targetHandleId: string
): { valid: boolean; reason?: string } {
  const sourceOutputType = OUTPUT_HANDLE_TYPES[sourceNodeType];
  const acceptedTypes = HANDLE_TYPES[targetHandleId];

  if (!acceptedTypes) {
    // No type restriction on this handle
    return { valid: true };
  }

  if (
    !acceptedTypes.includes(sourceOutputType) &&
    !acceptedTypes.includes("any" as HandleType)
  ) {
    return {
      valid: false,
      reason: `Cannot connect ${sourceOutputType} output to a handle expecting ${acceptedTypes.join(" or ")}`,
    };
  }

  return { valid: true };
}

/**
 * Get nodes that need to run based on scope
 */
export function getNodesToRun(
  nodes: FlowNode[],
  edges: FlowEdge[],
  scope: "FULL" | "PARTIAL" | "SINGLE",
  selectedNodeIds?: string[]
): FlowNode[] {
  if (scope === "FULL") return nodes;

  if (!selectedNodeIds?.length) return nodes;

  if (scope === "SINGLE") {
    return nodes.filter((n) => selectedNodeIds.includes(n.id));
  }

  // PARTIAL: selected nodes + their transitive dependencies
  const toInclude = new Set(selectedNodeIds);

  // Add all upstream dependencies recursively
  const addDependencies = (nodeId: string) => {
    const upstreams = getUpstreamNodes(nodeId, edges);
    for (const upstreamId of upstreams) {
      if (!toInclude.has(upstreamId)) {
        toInclude.add(upstreamId);
        addDependencies(upstreamId);
      }
    }
  };

  for (const nodeId of selectedNodeIds) {
    addDependencies(nodeId);
  }

  return nodes.filter((n) => toInclude.has(n.id));
}

/**
 * Resolve inputs for a node from previous node outputs
 */
export function resolveNodeInputs(
  node: FlowNode,
  edges: FlowEdge[],
  nodeOutputs: Map<string, Record<string, unknown>>
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};

  // Find all edges targeting this node
  const incomingEdges = edges.filter((e) => e.target === node.id);

  for (const edge of incomingEdges) {
    const sourceOutput = nodeOutputs.get(edge.source);
    if (!sourceOutput) continue;

    const handleId = edge.targetHandle ?? "default";

    // Multi-image support: images handle accepts multiple
    if (handleId === "images" || handleId?.includes("images")) {
      if (!Array.isArray(inputs[handleId])) {
        inputs[handleId] = [];
      }
      const arr = inputs[handleId] as unknown[];
      const val = sourceOutput.imageUrl ?? sourceOutput.text ?? sourceOutput.raw;
      if (val) arr.push(val);
    } else {
      // Primary value: prefer typed outputs
      inputs[handleId] =
        sourceOutput.text ??
        sourceOutput.imageUrl ??
        sourceOutput.videoUrl ??
        sourceOutput.raw;
    }
  }

  return inputs;
}
