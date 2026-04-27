import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ArrowRight, Zap, GitBranch, Play, Layers } from "lucide-react";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect("/workflow");

  return (
    <main className="min-h-screen bg-canvas flex flex-col overflow-auto">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-subtle">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent-purple flex items-center justify-center">
            <GitBranch className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-text-primary tracking-tight">NextFlow</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="text-sm bg-accent-purple hover:bg-accent-purple-light text-white px-4 py-2 rounded-lg transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-glow border border-accent-purple/30 text-accent-purple-light text-xs font-medium mb-8">
          <Zap className="w-3 h-3" />
          Powered by Gemini &amp; Trigger.dev
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-text-primary tracking-tight mb-6 max-w-4xl">
          Build{" "}
          <span className="text-gradient-purple">LLM workflows</span>{" "}
          visually
        </h1>

        <p className="text-text-secondary text-lg md:text-xl max-w-2xl mb-10 leading-relaxed">
          Connect AI nodes, process images and videos, and run complex multi-step
          pipelines — all with a drag-and-drop canvas.
        </p>

        <div className="flex items-center gap-4">
          <Link
            href="/sign-up"
            className="flex items-center gap-2 bg-accent-purple hover:bg-accent-purple-light text-white px-6 py-3 rounded-xl font-medium transition-colors"
          >
            Start building
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/sign-in"
            className="text-text-secondary hover:text-text-primary px-6 py-3 rounded-xl border border-subtle hover:border-border-strong transition-all"
          >
            Sign in
          </Link>
        </div>

        {/* Feature grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-24 max-w-4xl w-full text-left">
          {[
            {
              icon: <Layers className="w-5 h-5 text-accent-purple" />,
              title: "6 Node Types",
              desc: "Text, images, video, LLM, crop, and frame extraction nodes.",
            },
            {
              icon: <Play className="w-5 h-5 text-accent-purple" />,
              title: "Parallel Execution",
              desc: "Independent branches execute concurrently for maximum speed.",
            },
            {
              icon: <GitBranch className="w-5 h-5 text-accent-purple" />,
              title: "DAG Workflows",
              desc: "Build complex pipelines with typed connections and cycle prevention.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="p-5 rounded-xl bg-surface border border-subtle"
            >
              <div className="w-9 h-9 rounded-lg bg-accent-glow border border-accent-purple/20 flex items-center justify-center mb-3">
                {f.icon}
              </div>
              <h3 className="font-semibold text-text-primary mb-1">{f.title}</h3>
              <p className="text-text-secondary text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
