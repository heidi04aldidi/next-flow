import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getWorkflow, getWorkflowRuns, serializeRuns } from "@/lib/db/workflows";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workflowId } = await params;

    // Verify the workflow belongs to this user
    const workflow = await getWorkflow(workflowId, userId);
    if (!workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    const runs = await getWorkflowRuns(workflowId, userId);
    const serialized = serializeRuns(runs);

    return NextResponse.json({ runs: serialized }, { status: 200 });
  } catch (error) {
    console.error("[get workflow runs]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
