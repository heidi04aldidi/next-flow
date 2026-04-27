import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getWorkflow, getWorkflowRuns, serializeRuns } from "@/lib/db/workflows";
import type { WorkflowRunRecord } from "@/types";
import WorkflowEditor from "@/components/layout/WorkflowEditor";

interface WorkflowPageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function WorkflowPage({ searchParams }: WorkflowPageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const params = await searchParams;
  const workflowId = params.id;

  let initialWorkflow = null;
  let initialRuns: WorkflowRunRecord[] = [];

  if (workflowId) {
    const workflow = await getWorkflow(workflowId, userId);
    if (workflow) {
      initialWorkflow = {
        id: workflow.id,
        name: workflow.name,
        nodes: workflow.nodes as object[],
        edges: workflow.edges as object[],
        viewport: workflow.viewport as object | undefined,
      };
      const runs = await getWorkflowRuns(workflowId, userId);
      initialRuns = serializeRuns(runs);
    }
  }

  return (
    <WorkflowEditor
      userId={userId}
      initialWorkflow={initialWorkflow}
      initialRuns={initialRuns}
    />
  );
}
