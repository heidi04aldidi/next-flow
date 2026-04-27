import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { saveWorkflow } from "@/lib/db/workflows";
import { SaveWorkflowSchema } from "@/lib/validations/schemas";
import type { FlowNode, FlowEdge } from "@/types";
import { ZodError } from "zod";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const validated = SaveWorkflowSchema.parse(body);
    const id = validated.workflowId ?? crypto.randomUUID();

    const workflow = await saveWorkflow(id, userId, {
      name: validated.name,
      nodes: validated.nodes as unknown as FlowNode[],
      edges: validated.edges as unknown as FlowEdge[],
      viewport: validated.viewport,
    });

    return NextResponse.json({ workflow }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.flatten() },
        { status: 400 }
      );
    }
    console.error("[save workflow]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
