import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;
import { executeWorkflow } from "@/lib/trigger/executor";
import { getWorkflow, getWorkflowRuns, serializeRuns } from "@/lib/db/workflows";
import { RunWorkflowSchema } from "@/lib/validations/schemas";
import { ZodError } from "zod";
import type { FlowNode, FlowEdge } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = RunWorkflowSchema.parse(body);

    // Verify ownership
    const workflow = await getWorkflow(validated.workflowId, userId);
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const result = await executeWorkflow(
      validated.workflowId,
      userId,
      validated.nodes as unknown as FlowNode[],
      validated.edges as unknown as FlowEdge[],
      validated.scope,
      validated.selectedNodeIds
    );

    // Return updated runs alongside result
    const runs = await getWorkflowRuns(validated.workflowId, userId);
    const serializedRuns = serializeRuns(runs);

    return NextResponse.json({ result, runs: serializedRuns }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("[run workflow]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
