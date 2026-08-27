import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Mail, ArrowLeft } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { Input, Label } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Invalid email", "Please enter a valid email address.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setSent(true);
      setLoading(false);
      toast.success("Reset link dispatched", `Check ${email} for instructions.`);
    }, 800);
  };

  if (sent) {
    return (
      <div className="text-center py-4">
        <div className="from-emerald-400/20 to-emerald-500/10 border border-emerald-500/30 mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg">
          <CheckCircle2 className="size-8 text-emerald-400" />
        </div>
        <h1 className="font-display text-default mt-5 text-2xl font-bold">
          Check Your Inbox
        </h1>
        <p className="text-muted mt-2 text-xs sm:text-sm leading-relaxed">
          We sent a secure password recovery link to{" "}
          <span className="text-default font-bold">{email}</span>.
        </p>
        <Link to="/login" className="mt-7 inline-block w-full">
          <Button variant="secondary" size="lg" className="w-full" leftIcon={ArrowLeft}>
            Back to Sign In
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-default text-2xl sm:text-3xl font-extrabold">
          Reset Password
        </h1>
        <p className="text-muted mt-1.5 text-xs sm:text-sm">
          Enter your registered email and we'll send you recovery steps.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            leftIcon={Mail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" size="lg" className="w-full mt-2" loading={loading}>
          Send Recovery Link
        </Button>
      </form>

      <p className="text-muted mt-6 text-center text-xs sm:text-sm">
        Remember your password?{" "}
        <Link to="/login" className="text-brand-400 font-bold hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
