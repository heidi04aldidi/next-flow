import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <SignUp />
    </div>
  );
}
